/**
 * Failing-first unit tests for verified Google identity resolution,
 * duplicate/cross-field collision rejection, and canonical User/Vendor linking.
 * Runs: node tests/googleIdentityResolution.test.js
 *
 * =============================================================================
 * CONTRACT for backend/src/utils/identityResolution.js  (implemented by Task 3.2)
 * =============================================================================
 * This file is the executable contract for the NEW utility module
 * `backend/src/utils/identityResolution.js`, which does NOT exist yet. Running
 * this file now fails at the require below with MODULE_NOT_FOUND — that is the
 * red-phase (failing-first) evidence. Task 3.2 implements the module to the
 * exact signatures, return shapes, and error codes documented here; this file
 * then runs green and locks the behavior.
 *
 * The module MAY reuse `normalizeEmail` from `./studioAccess` (lowercase +
 * trim). All inputs SHALL be normalized by the module before any query.
 *
 * -----------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------
 *   1) findIdentityForGoogle({ models, verifiedGoogleId, verifiedGoogleEmail })
 *   2) assertIdentityUnique({ models, application })
 *   3) linkVerifiedIdentityToCanonicalUser({
 *        models, application, verifiedGoogleId, verifiedGoogleEmail
 *      })
 *
 * `models` is a dependency-injected object exposing only what the module needs
 * so it stays unit-testable with the in-memory store in this file:
 *
 *   models.User.findOne(query)             -> Promise<object|null>
 *   models.User.create(data)               -> Promise<object>   (never called by linking)
 *   models.VendorApplication.findOne(q)    -> Promise<object|null>
 *   models.VendorApplication.find(query)   -> Promise<object[]>  (all matches)
 *   models.Vendor.findOne({ owner })       -> Promise<object|null>
 *   found user objects may expose .save()  -> the module mutates and persists
 *                                            googleId/googleEmail via user.save()
 *
 * -----------------------------------------------------------------------------
 * 1) findIdentityForGoogle({ models, verifiedGoogleId, verifiedGoogleEmail })
 * -----------------------------------------------------------------------------
 * Resolves a VERIFIED Google identity (subject ID + email from the OAuth
 * userinfo response — never client-supplied values) to one application/user
 * with subject-ID precedence and unique-normalized-email fallback.
 *
 * Resolution order:
 *   a. SUBJECT ID — if an application has verifiedGoogleId === subject, resolve
 *      exactly that application regardless of any editable/email fields.
 *      Existing user is looked up by { $or: [{ googleId }, { email: app.email }] }.
 *      If no application matched but a User has googleId === subject, resolve
 *      that user with application: null.
 *   b. EMAIL FALLBACK — only when no subject-ID match. Normalize
 *      verifiedGoogleEmail (lowercase + trim) and find ALL applications where
 *      email OR googleEmail OR verifiedGoogleEmail equals the normalized value.
 *      Exactly one application -> resolve it (existing user looked up by
 *      app.email, the canonical contact email). Exactly one User by normalized
 *      email with no application -> resolve the user. More than one record
 *      (e.g. contact email of one + verifiedGoogleEmail of another) -> FAIL
 *      CLOSED with error 'identity_ambiguous'. The module must never silently
 *      pick one candidate.
 *
 * Returns (success):
 *   { ok: true, resolution: 'subject_id'|'email',
 *     application: object|null, existingUser: object|null }
 * Returns (failure):
 *   { ok: false, error: 'identity_ambiguous' }  // >1 application matched email
 *   { ok: false, error: 'no_identity' }         // nothing matched
 *
 * -----------------------------------------------------------------------------
 * 2) assertIdentityUnique({ models, application })
 * -----------------------------------------------------------------------------
 * Rejects a NEW VendorApplication that would violate identity uniqueness.
 * Checks (each against OTHER applications in the store):
 *   - duplicate verifiedGoogleId            (another app has same verifiedGoogleId)
 *   - duplicate verifiedGoogleEmail         (another app has same verifiedGoogleEmail)
 *   - cross-field: application.email        === another app's verifiedGoogleEmail
 *                                            or another app's googleEmail (legacy)
 *   - cross-field: application.verifiedGoogleEmail === another app's email
 *
 * Returns { ok: true } or { ok: false, error: 'identity_collision' }.
 * The error is GENERIC and NON-ENUMERATING: it carries no field name, email,
 * or subject value, so callers can never learn which record collided.
 *
 * -----------------------------------------------------------------------------
 * 3) linkVerifiedIdentityToCanonicalUser({ models, application,
 *                                          verifiedGoogleId, verifiedGoogleEmail })
 * -----------------------------------------------------------------------------
 * Attaches an APPROVED application's verified Google identity to the canonical
 * invited/vendor User (matched by application.email, the contact email) and the
 * existing Vendor profile owned by that User. It NEVER creates a second User or
 * Vendor: if the canonical User or Vendor is missing it fails closed instead of
 * creating. It stores verifiedGoogleId and normalized verifiedGoogleEmail on
 * the canonical User (mutating + persisting via user.save()).
 *
 * Returns (success):
 *   { ok: true, user, vendor, createdUser: false, createdVendor: false }
 * Returns (failure):
 *   { ok: false, error: 'no_approved_application' }  // status !== 'approved'
 *   { ok: false, error: 'no_verified_identity' }     // missing verifiedGoogleId/Email
 *   { ok: false, error: 'no_canonical_user' }        // no User by application.email
 *   { ok: false, error: 'no_canonical_vendor' }      // no Vendor owned by canonical user
 *
 * -----------------------------------------------------------------------------
 * Error codes (exact strings)
 * -----------------------------------------------------------------------------
 *   'no_identity', 'identity_ambiguous', 'identity_collision',
 *   'no_approved_application', 'no_verified_identity',
 *   'no_canonical_user', 'no_canonical_vendor'
 * =============================================================================
 */
const assert = require('assert');
const crypto = require('crypto');

// This require is the failing-first proof: the module does not exist yet, so
// this file crashes with MODULE_NOT_FOUND (exit code 1) until Task 3.2 ships it.
const {
  findIdentityForGoogle,
  assertIdentityUnique,
  linkVerifiedIdentityToCanonicalUser,
} = require('../src/utils/identityResolution');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// In-memory model store. Mirrors the pattern in googleRegistrationDraft.test.js
// but adds VendorApplication.find (all matches — required for ambiguity
// detection), general $or support, and user.save() persistence.
// ---------------------------------------------------------------------------
const matchClause = (record, clause) =>
  Object.entries(clause).every(([k, v]) => record[k] === v);

const matchQuery = (record, query) =>
  query.$or ? query.$or.some((clause) => matchClause(record, clause)) : matchClause(record, query);

const createMockModels = (overrides = {}) => {
  const store = {
    users: overrides.users || [],
    apps: overrides.apps || [],
    vendors: overrides.vendors || [],
  };

  return {
    store,
    User: {
      findOne: async (query) => store.users.find((u) => matchQuery(u, query)) || null,
      create: async (data) => {
        const user = {
          _id: crypto.randomBytes(12).toString('hex'),
          save: async function save() { return this; },
          ...data,
        };
        store.users.push(user);
        return user;
      },
    },
    VendorApplication: {
      findOne: async (query) => store.apps.find((a) => matchQuery(a, query)) || null,
      find: async (query) => store.apps.filter((a) => matchQuery(a, query)),
    },
    Vendor: {
      findOne: async (query) => store.vendors.find((v) => matchQuery(v, query)) || null,
      create: async (data) => {
        const vendor = { _id: crypto.randomBytes(12).toString('hex'), ...data };
        store.vendors.push(vendor);
        return vendor;
      },
    },
  };
};

const mkUser = (data) => ({
  _id: crypto.randomBytes(12).toString('hex'),
  save: async function save() { return this; },
  ...data,
});

const mkApp = (data) => ({
  _id: crypto.randomBytes(12).toString('hex'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...data,
});

async function runIdentityResolutionTests() {
  // ============================ SUBJECT-ID PRECEDENCE ======================
  await checkAsync('findIdentityForGoogle: subject ID match resolves the exact application despite a different Google email', async () => {
    const { User, VendorApplication } = createMockModels({
      apps: [mkApp({
        email: 'contact@studio.com',
        verifiedGoogleEmail: 'owner@gmail.com',
        verifiedGoogleId: 'sub-1',
        status: 'approved',
        studioName: 'Subject Studio',
      })],
      users: [mkUser({ email: 'contact@studio.com', role: 'vendor', isActive: true })],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-1',
      verifiedGoogleEmail: 'completely-different@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'subject_id');
    assert.strictEqual(r.application.email, 'contact@studio.com');
    assert.strictEqual(r.application.studioName, 'Subject Studio');
    assert.strictEqual(r.existingUser.email, 'contact@studio.com');
  });

  await checkAsync('findIdentityForGoogle: subject ID match resolves an existing user with no application', async () => {
    const { User, VendorApplication } = createMockModels({
      users: [mkUser({ email: 'old@x.com', googleId: 'sub-1', role: 'vendor', isActive: true })],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-1',
      verifiedGoogleEmail: 'new@x.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'subject_id');
    assert.strictEqual(r.existingUser.email, 'old@x.com');
    assert.strictEqual(r.application, null);
  });

  await checkAsync('findIdentityForGoogle: subject ID wins over an ambiguous email (precedence)', async () => {
    const { User, VendorApplication } = createMockModels({
      apps: [
        mkApp({ email: 'c1@studio.com', verifiedGoogleEmail: 'amb@gmail.com', verifiedGoogleId: 'sub-1', status: 'approved' }),
        mkApp({ email: 'amb@gmail.com', status: 'pending' }),
      ],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-1',
      verifiedGoogleEmail: 'amb@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'subject_id');
    assert.strictEqual(r.application.email, 'c1@studio.com');
  });

  // ============================ EMAIL FALLBACK =============================
  await checkAsync('findIdentityForGoogle: unique contact-email fallback is case-insensitive and trimmed', async () => {
    const { User, VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'brand@studio.com', status: 'approved', studioName: 'Brand Studio' })],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-new',
      verifiedGoogleEmail: '  BRAND@Studio.COM ',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'email');
    assert.strictEqual(r.application.email, 'brand@studio.com');
  });

  await checkAsync('findIdentityForGoogle: unique verified Google email fallback', async () => {
    const { User, VendorApplication } = createMockModels({
      apps: [mkApp({
        email: 'contact@studio.com',
        verifiedGoogleEmail: 'owner@gmail.com',
        verifiedGoogleId: 'sub-old',
        status: 'approved',
      })],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-new',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'email');
    assert.strictEqual(r.application.email, 'contact@studio.com');
  });

  await checkAsync('findIdentityForGoogle: unique user email fallback (active vendor, no application)', async () => {
    const { User, VendorApplication } = createMockModels({
      users: [mkUser({ email: 'vendor@x.com', role: 'vendor', isActive: true })],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-new',
      verifiedGoogleEmail: 'vendor@x.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.resolution, 'email');
    assert.strictEqual(r.existingUser.email, 'vendor@x.com');
    assert.strictEqual(r.application, null);
  });

  await checkAsync('findIdentityForGoogle: no match fails with no_identity', async () => {
    const { User, VendorApplication } = createMockModels();
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-none',
      verifiedGoogleEmail: 'nobody@x.com',
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'no_identity');
  });

  // ============================ FAIL CLOSED ON AMBIGUITY ===================
  await checkAsync('findIdentityForGoogle: ambiguous email fails closed with identity_ambiguous (never picks one)', async () => {
    const { User, VendorApplication } = createMockModels({
      apps: [
        mkApp({ email: 'shared@studio.com', status: 'approved', studioName: 'First' }),
        mkApp({ email: 'other@studio.com', verifiedGoogleEmail: 'shared@studio.com', status: 'approved', studioName: 'Second' }),
      ],
    });
    const r = await findIdentityForGoogle({
      models: { User, VendorApplication },
      verifiedGoogleId: 'sub-new',
      verifiedGoogleEmail: 'shared@studio.com',
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_ambiguous');
    assert.strictEqual(r.application, undefined);
  });

  // ============================ UNIQUENESS / COLLISIONS ====================
  await checkAsync('assertIdentityUnique: duplicate verifiedGoogleId on another application rejected', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'a@studio.com', verifiedGoogleEmail: 'a@gmail.com', verifiedGoogleId: 'dup-sub' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'b@studio.com', verifiedGoogleEmail: 'b@gmail.com', verifiedGoogleId: 'dup-sub' },
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_collision');
  });

  await checkAsync('assertIdentityUnique: duplicate verified Google email on another application rejected', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'a@studio.com', verifiedGoogleEmail: 'dup@gmail.com', verifiedGoogleId: 'sub-a' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'b@studio.com', verifiedGoogleEmail: 'dup@gmail.com', verifiedGoogleId: 'sub-b' },
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_collision');
  });

  await checkAsync('assertIdentityUnique: contact email colliding with another application verified Google email rejected', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'c1@studio.com', verifiedGoogleEmail: 'shared@studio.com', verifiedGoogleId: 'sub-a' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'shared@studio.com', verifiedGoogleId: 'sub-b' },
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_collision');
  });

  await checkAsync('assertIdentityUnique: verified Google email colliding with another application contact email rejected', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'claimed@studio.com', status: 'pending' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'other@studio.com', verifiedGoogleEmail: 'claimed@studio.com', verifiedGoogleId: 'sub-c' },
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_collision');
  });

  await checkAsync('assertIdentityUnique: clean identity passes', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'existing@studio.com', verifiedGoogleEmail: 'existing@gmail.com', verifiedGoogleId: 'sub-existing' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'fresh@studio.com', verifiedGoogleEmail: 'fresh@gmail.com', verifiedGoogleId: 'sub-fresh' },
    });
    assert.strictEqual(r.ok, true);
  });

  await checkAsync('assertIdentityUnique: collision error is generic and non-enumerating', async () => {
    const { VendorApplication } = createMockModels({
      apps: [mkApp({ email: 'a@studio.com', verifiedGoogleEmail: 'dup@gmail.com', verifiedGoogleId: 'dup-sub' })],
    });
    const r = await assertIdentityUnique({
      models: { VendorApplication },
      application: { email: 'b@studio.com', verifiedGoogleEmail: 'dup@gmail.com', verifiedGoogleId: 'dup-sub' },
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'identity_collision');
    // Must not leak which field, email, or subject collided.
    assert.strictEqual(r.field, undefined);
    assert.strictEqual(r.email, undefined);
    assert.strictEqual(r.googleId, undefined);
  });

  // ============================ CANONICAL USER/VENDOR LINKING ==============
  await checkAsync('linkVerifiedIdentityToCanonicalUser: approved app with differing contact/Google emails links the canonical User by contact email', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true, authProvider: 'local' });
    const { User, Vendor } = createMockModels({
      users: [canonicalUser],
      vendors: [{ _id: crypto.randomBytes(12).toString('hex'), name: 'Brand Studio', owner: canonicalUser._id }],
    });
    const application = mkApp({
      email: 'brand@studio.com',          // contact email A
      verifiedGoogleEmail: 'owner@gmail.com', // verified Google email B (different)
      verifiedGoogleId: 'sub-9',
      status: 'approved',
      studioName: 'Brand Studio',
    });
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User, Vendor },
      application,
      verifiedGoogleId: 'sub-9',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.user.email, 'brand@studio.com');
    assert.strictEqual(r.user._id, canonicalUser._id);
    assert.strictEqual(r.user.googleId, 'sub-9');
    assert.strictEqual(r.user.googleEmail, 'owner@gmail.com');
    assert.strictEqual(r.createdUser, false);
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: returns the existing Vendor profile owned by the canonical User', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true });
    const vendor = { _id: crypto.randomBytes(12).toString('hex'), name: 'Brand Studio', owner: canonicalUser._id };
    const { User, Vendor } = createMockModels({ users: [canonicalUser], vendors: [vendor] });
    const application = mkApp({
      email: 'brand@studio.com',
      verifiedGoogleEmail: 'owner@gmail.com',
      verifiedGoogleId: 'sub-9',
      status: 'approved',
    });
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User, Vendor },
      application,
      verifiedGoogleId: 'sub-9',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.vendor._id, vendor._id);
    assert.strictEqual(r.vendor.owner, canonicalUser._id);
    assert.strictEqual(r.createdVendor, false);
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: never creates a second User', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true });
    const models = createMockModels({
      users: [canonicalUser],
      vendors: [{ _id: crypto.randomBytes(12).toString('hex'), name: 'Brand Studio', owner: canonicalUser._id }],
    });
    const application = mkApp({
      email: 'brand@studio.com',
      verifiedGoogleEmail: 'owner@gmail.com',
      verifiedGoogleId: 'sub-9',
      status: 'approved',
    });
    const before = models.store.users.length;
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User: models.User, Vendor: models.Vendor },
      application,
      verifiedGoogleId: 'sub-9',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(models.store.users.length, before);
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: never creates a second Vendor', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true });
    const models = createMockModels({
      users: [canonicalUser],
      vendors: [{ _id: crypto.randomBytes(12).toString('hex'), name: 'Brand Studio', owner: canonicalUser._id }],
    });
    const application = mkApp({
      email: 'brand@studio.com',
      verifiedGoogleEmail: 'owner@gmail.com',
      verifiedGoogleId: 'sub-9',
      status: 'approved',
    });
    const before = models.store.vendors.length;
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User: models.User, Vendor: models.Vendor },
      application,
      verifiedGoogleId: 'sub-9',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(models.store.vendors.length, before);
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: approved sxvocusa returning-vendor data stays canonical (contact email differs from Google email)', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true });
    const vendor = { _id: crypto.randomBytes(12).toString('hex'), name: 'Linked Studio', owner: canonicalUser._id };
    const models = createMockModels({
      apps: [mkApp({
        email: 'brand@studio.com',
        googleEmail: 'sxvocusa@gmail.com',
        status: 'approved',
        studioName: 'Linked Studio',
      })],
      users: [canonicalUser],
      vendors: [vendor],
    });
    // Full flow: resolve via verified Google email (mixed case, trimmed input),
    // then link the verified identity to the canonical contact-email account.
    const resolved = await findIdentityForGoogle({
      models: { User: models.User, VendorApplication: models.VendorApplication },
      verifiedGoogleId: 'sub-return',
      verifiedGoogleEmail: '  SXVOCUSA@Gmail.com ',
    });
    assert.strictEqual(resolved.ok, true);
    assert.strictEqual(resolved.resolution, 'email');
    assert.strictEqual(resolved.application.email, 'brand@studio.com');

    const beforeUsers = models.store.users.length;
    const beforeVendors = models.store.vendors.length;
    const linked = await linkVerifiedIdentityToCanonicalUser({
      models: { User: models.User, Vendor: models.Vendor },
      application: resolved.application,
      verifiedGoogleId: 'sub-return',
      verifiedGoogleEmail: 'sxvocusa@gmail.com',
    });
    assert.strictEqual(linked.ok, true);
    assert.strictEqual(linked.user.email, 'brand@studio.com');
    assert.strictEqual(linked.user.googleId, 'sub-return');
    assert.strictEqual(linked.user.googleEmail, 'sxvocusa@gmail.com');
    assert.strictEqual(linked.vendor._id, vendor._id);
    assert.strictEqual(models.store.users.length, beforeUsers);
    assert.strictEqual(models.store.vendors.length, beforeVendors);
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: non-approved application rejected', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'user', isActive: true });
    const { User, Vendor } = createMockModels({ users: [canonicalUser] });
    const application = mkApp({
      email: 'brand@studio.com',
      verifiedGoogleEmail: 'owner@gmail.com',
      verifiedGoogleId: 'sub-9',
      status: 'pending',
    });
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User, Vendor },
      application,
      verifiedGoogleId: 'sub-9',
      verifiedGoogleEmail: 'owner@gmail.com',
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'no_approved_application');
  });

  await checkAsync('linkVerifiedIdentityToCanonicalUser: missing verified identity rejected', async () => {
    const canonicalUser = mkUser({ email: 'brand@studio.com', role: 'vendor', isActive: true });
    const { User, Vendor } = createMockModels({
      users: [canonicalUser],
      vendors: [{ _id: crypto.randomBytes(12).toString('hex'), name: 'Brand Studio', owner: canonicalUser._id }],
    });
    const application = mkApp({ email: 'brand@studio.com', status: 'approved' });
    const r = await linkVerifiedIdentityToCanonicalUser({
      models: { User, Vendor },
      application,
      verifiedGoogleId: null,
      verifiedGoogleEmail: null,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'no_verified_identity');
  });
}

(async () => {
  await runIdentityResolutionTests();
  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll googleIdentityResolution tests passed');
})();
