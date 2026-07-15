/**
 * Pure decision for vendor-studio Google (and similar) entry.
 * Call after loading User + VendorApplication by normalized email.
 *
 * Returning active vendor/admin may enter without a new application.
 * Everyone else needs VendorApplication.status === 'approved'.
 *
 * Application match: verified Google subject/email first, then legacy contact fields.
 */

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/**
 * @param {{ existingUser?: object|null, application?: object|null }} input
 * @returns {{ ok: true, existingUser: object|null, application: object|null } | { ok: false, error: string }}
 */
function decideStudioAccess({ existingUser = null, application = null } = {}) {
  if (existingUser) {
    if (existingUser.isActive === false) {
      return { ok: false, error: 'account_suspended' };
    }
    if (existingUser.role === 'vendor' || existingUser.role === 'admin') {
      return { ok: true, existingUser, application: application || null };
    }
  }

  if (!application) {
    return { ok: false, error: 'no_application' };
  }
  if (application.status === 'pending') {
    return { ok: false, error: 'application_pending' };
  }
  if (application.status === 'rejected') {
    return { ok: false, error: 'application_rejected' };
  }
  if (application.status !== 'approved') {
    return { ok: false, error: 'no_application' };
  }

  return { ok: true, existingUser: existingUser || null, application };
}

/**
 * Find application where Google/login email matches contact email OR linked googleEmail.
 */
async function findApplicationForGoogleIdentity(VendorApplication, normalizedEmail, googleId) {
  return VendorApplication.findOne({
    $or: [
      ...(googleId ? [{ verifiedGoogleId: googleId }] : []),
      { verifiedGoogleEmail: normalizedEmail },
      { email: normalizedEmail },
      { googleEmail: normalizedEmail },
    ],
  });
}

/**
 * DB-backed gate used by Google OAuth callback.
 * @param {string} email - Google account email from OAuth
 * @param {{ User: any, VendorApplication: any }} models
 */
async function assertStudioAccessAllowed(email, models, googleId) {
  const User = models.User;
  const VendorApplication = models.VendorApplication;
  const normalized = normalizeEmail(email);

  const existingUser = await User.findOne({
    $or: [
      ...(googleId ? [{ googleId }] : []),
      { email: normalized },
    ],
  });
  const application = await findApplicationForGoogleIdentity(
    VendorApplication,
    normalized,
    googleId,
  );

  return decideStudioAccess({ existingUser, application });
}

module.exports = {
  normalizeEmail,
  decideStudioAccess,
  findApplicationForGoogleIdentity,
  assertStudioAccessAllowed,
};
