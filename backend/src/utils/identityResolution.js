/**
 * Deterministic, collision-safe resolution of verified Google identities and
 * canonical User/Vendor linking.
 *
 * Contract source: backend/tests/googleIdentityResolution.test.js (Task 1.2).
 * Implemented by Task 3.2. All inputs are normalized (lowercase + trim) before
 * any query. The module is dependency-injected (`models`) and pure — no
 * mongoose connection, no env reads at load time.
 *
 * Model interface used:
 *   models.User.findOne(query)          -> Promise<object|null>
 *   models.VendorApplication.findOne(q) -> Promise<object|null>
 *   models.VendorApplication.find(q)    -> Promise<object[]>  (ALL matches)
 *   models.Vendor.findOne({ owner })    -> Promise<object|null>
 *   found users may expose .save()      -> persisted after googleId/googleEmail mutation
 */

const { normalizeEmail } = require('./studioAccess');

/**
 * Resolve a VERIFIED Google identity (subject ID + email from the OAuth
 * userinfo response — never client-supplied values) to one application/user.
 *
 * Order:
 *   a. SUBJECT ID — application by verifiedGoogleId first, then User by googleId.
 *   b. EMAIL FALLBACK — unique normalized email across application email /
 *      googleEmail / verifiedGoogleEmail; >1 match fails closed.
 *
 * @param {{ models: { User: any, VendorApplication: any },
 *           verifiedGoogleId?: string, verifiedGoogleEmail?: string }} input
 * @returns {Promise<{ ok: true, resolution: 'subject_id'|'email',
 *                     application: object|null, existingUser: object|null }
 *                 | { ok: false, error: 'identity_ambiguous'|'no_identity' }>}
 */
async function findIdentityForGoogle({ models, verifiedGoogleId, verifiedGoogleEmail }) {
  const { User, VendorApplication } = models;

  if (verifiedGoogleId) {
    const appBySubject = await VendorApplication.findOne({ verifiedGoogleId });
    if (appBySubject) {
      const existingUser = await User.findOne({
        $or: [
          { googleId: verifiedGoogleId },
          { email: normalizeEmail(appBySubject.email) },
        ],
      });
      return {
        ok: true,
        resolution: 'subject_id',
        application: appBySubject,
        existingUser: existingUser || null,
      };
    }
    const userBySubject = await User.findOne({ googleId: verifiedGoogleId });
    if (userBySubject) {
      return { ok: true, resolution: 'subject_id', application: null, existingUser: userBySubject };
    }
  }

  const normalizedEmail = normalizeEmail(verifiedGoogleEmail);
  if (normalizedEmail) {
    const emailMatches = await VendorApplication.find({
      $or: [
        { email: normalizedEmail },
        { googleEmail: normalizedEmail },
        { verifiedGoogleEmail: normalizedEmail },
      ],
    });
    if (emailMatches.length > 1) {
      // Fail closed: ambiguous email match grants no access (no enumeration).
      return { ok: false, error: 'identity_ambiguous' };
    }
    if (emailMatches.length === 1) {
      const application = emailMatches[0];
      const existingUser = await User.findOne({ email: normalizeEmail(application.email) });
      return { ok: true, resolution: 'email', application, existingUser: existingUser || null };
    }
    const userByEmail = await User.findOne({ email: normalizedEmail });
    if (userByEmail) {
      return { ok: true, resolution: 'email', application: null, existingUser: userByEmail };
    }
  }

  return { ok: false, error: 'no_identity' };
}

/**
 * Reject a NEW VendorApplication that would violate identity uniqueness.
 * Checks against OTHER applications: duplicate verifiedGoogleId, duplicate
 * verifiedGoogleEmail, and cross-field collisions (contact email vs another
 * app's verified Google email / legacy googleEmail, and vice versa).
 *
 * The error is GENERIC and NON-ENUMERATING — no field name, email, or subject
 * value is leaked.
 *
 * @param {{ models: { VendorApplication: any }, application: object }} input
 * @returns {Promise<{ ok: true } | { ok: false, error: 'identity_collision' }>}
 */
async function assertIdentityUnique({ models, application }) {
  const { VendorApplication } = models;
  const app = application || {};

  if (app.verifiedGoogleId) {
    const dup = await VendorApplication.findOne({ verifiedGoogleId: app.verifiedGoogleId });
    if (dup) return { ok: false, error: 'identity_collision' };
  }

  const verifiedEmail = normalizeEmail(app.verifiedGoogleEmail);
  if (verifiedEmail) {
    const dup = await VendorApplication.findOne({ verifiedGoogleEmail: verifiedEmail });
    if (dup) return { ok: false, error: 'identity_collision' };
  }

  const contactEmail = normalizeEmail(app.email);
  if (contactEmail) {
    const cross = await VendorApplication.findOne({
      $or: [
        { verifiedGoogleEmail: contactEmail },
        { googleEmail: contactEmail },
      ],
    });
    if (cross) return { ok: false, error: 'identity_collision' };
  }

  if (verifiedEmail) {
    const cross = await VendorApplication.findOne({ email: verifiedEmail });
    if (cross) return { ok: false, error: 'identity_collision' };
  }

  return { ok: true };
}

/**
 * Attach an APPROVED application's verified Google identity to the canonical
 * invited/vendor User (matched by application.email, the contact email) and the
 * existing Vendor profile owned by that User. NEVER creates a second User or
 * Vendor — missing canonical records fail closed (creation is owned by the
 * admin-approval flow, task 4.2).
 *
 * @param {{ models: { User: any, Vendor: any },
 *           application: object,
 *           verifiedGoogleId: string, verifiedGoogleEmail: string }} input
 * @returns {Promise<{ ok: true, user: object, vendor: object,
 *                     createdUser: false, createdVendor: false }
 *                 | { ok: false, error: 'no_approved_application'
 *                     | 'no_verified_identity' | 'no_canonical_user'
 *                     | 'no_canonical_vendor' }>}
 */
async function linkVerifiedIdentityToCanonicalUser({
  models,
  application,
  verifiedGoogleId,
  verifiedGoogleEmail,
}) {
  const { User, Vendor } = models;

  if (!application || application.status !== 'approved') {
    return { ok: false, error: 'no_approved_application' };
  }
  if (!verifiedGoogleId || !verifiedGoogleEmail) {
    return { ok: false, error: 'no_verified_identity' };
  }

  const contactEmail = normalizeEmail(application.email);
  const user = await User.findOne({ email: contactEmail });
  if (!user) {
    return { ok: false, error: 'no_canonical_user' };
  }

  user.googleId = String(verifiedGoogleId);
  user.googleEmail = normalizeEmail(verifiedGoogleEmail);
  if (typeof user.save === 'function') {
    await user.save();
  }

  const vendor = await Vendor.findOne({ owner: user._id });
  if (!vendor) {
    return { ok: false, error: 'no_canonical_vendor' };
  }

  return { ok: true, user, vendor, createdUser: false, createdVendor: false };
}

module.exports = {
  findIdentityForGoogle,
  assertIdentityUnique,
  linkVerifiedIdentityToCanonicalUser,
};
