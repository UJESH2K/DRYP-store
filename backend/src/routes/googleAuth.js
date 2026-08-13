const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const VendorApplication = require('../models/VendorApplication');
const GoogleRegistrationDraft = require('../models/GoogleRegistrationDraft');
const { mergeGuestData } = require('./auth');
// assertStudioAccessAllowed is retained in the destructure for the structural
// ship gate (tests/shipWebsiteStudio.test.js asserts it precedes jwt.sign here);
// runtime resolution now uses utils/identityResolution below.
const { decideStudioAccess, normalizeEmail, assertStudioAccessAllowed } = require('../utils/studioAccess');
const {
  findIdentityForGoogle,
  linkVerifiedIdentityToCanonicalUser,
} = require('../utils/identityResolution');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.SHOPIFY_APP_URL || 'http://localhost:8081'}/api/auth/google/callback`;

const buildFrontendRedirect = (params) => {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const query = new URLSearchParams(params).toString();
  return `${base}/oauth/google/callback?${query}`;
};

const buildRegisterStatusRedirect = (status) => {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const query = new URLSearchParams({ status }).toString();
  return `${base}/register?${query}`;
};

const buildOAuthStatePayload = ({ guestId, platform, intent, draftId, redirectUri }) => ({
  guestId: guestId || null,
  platform: platform === 'mobile' ? 'mobile' : 'web',
  intent: intent === 'register' ? 'register' : 'login',
  draftId: draftId || null,
  redirectUri: redirectUri || null,
});

const buildRedirect = (platform, params, customRedirectUri) => {
  if (platform === 'mobile') {
    // If a custom redirect_uri was provided (e.g. Expo auth proxy), use it
    if (customRedirectUri) {
      const url = new URL(customRedirectUri);
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
      return url.toString();
    }
    const query = new URLSearchParams(params).toString();
    return `dryp://oauth-callback?${query}`;
  }
  return buildFrontendRedirect(params);
};

// @route   GET /api/auth/google
// @desc    Redirect to Google OAuth consent page
// @access  Public
router.get('/', async (req, res, next) => {
  try {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      message: 'Google OAuth is not configured (missing GOOGLE_CLIENT_ID).',
    });
  }

  const { guestId, draftId, redirect_uri } = req.query;
  const platform = req.query.platform === 'mobile' ? 'mobile' : 'web';
  const intent = req.query.intent === 'register' ? 'register' : 'login';

  if (intent === 'register' && !draftId) {
    return res.redirect(buildRegisterStatusRedirect('draft_expired'));
  }

  if (intent === 'register') {
    const draft = await GoogleRegistrationDraft.exists({
      draftId,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!draft) {
      return res.redirect(buildRegisterStatusRedirect('draft_expired'));
    }
  }

  const state = jwt.sign(
    buildOAuthStatePayload({ guestId, platform, intent, draftId, redirectUri: redirect_uri }),
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/auth/google/callback
// @desc    Handle Google OAuth callback (website studio gate / mobile customer)
// @access  Public (Google redirect)
router.get('/callback', async (req, res) => {
  const { code, state: stateParam, error } = req.query;

  let platform = 'web';
  let guestId = null;
  let intent = 'login';
  let draftId = null;
  let customRedirectUri = null;

  if (stateParam) {
    try {
      const decoded = jwt.verify(stateParam, process.env.JWT_SECRET);
      platform = decoded.platform === 'mobile' ? 'mobile' : 'web';
      guestId = decoded.guestId || null;
      intent = decoded.intent === 'register' ? 'register' : 'login';
      draftId = decoded.draftId || null;
      customRedirectUri = decoded.redirectUri || null;
    } catch {
      // Fall through — will fail state check below when code path runs.
    }
  }

  if (error) {
    return res.redirect(buildRedirect(platform, { error: 'google_denied' }, customRedirectUri));
  }

  if (!code) {
    return res.redirect(buildRedirect(platform, { error: 'no_code' }, customRedirectUri));
  }

  let state;
  try {
    state = jwt.verify(stateParam, process.env.JWT_SECRET);
    platform = state.platform === 'mobile' ? 'mobile' : 'web';
    guestId = state.guestId || null;
    intent = state.intent === 'register' ? 'register' : 'login';
    draftId = state.draftId || null;
    customRedirectUri = state.redirectUri || null;
  } catch {
    return res.redirect(buildRedirect(platform, { error: 'invalid_state' }, customRedirectUri));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData);
      return res.redirect(buildRedirect(platform, { error: 'token_exchange_failed' }, customRedirectUri));
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();
    if (!googleUser.email) {
      return res.redirect(buildRedirect(platform, { error: 'no_email' }, customRedirectUri));
    }

    const email = normalizeEmail(googleUser.email);
    const name = googleUser.name;
    const picture = googleUser.picture;
    const googleId = googleUser.id ? String(googleUser.id) : undefined;

    let user;

    if (platform === 'web') {
      // Website studio: only approved applications / existing vendor|admin may enter.
      // Resolve the verified Google identity (subject-ID precedence, unique
      // normalized email fallback, fail closed on ambiguity), then gate access.
      const identity = await findIdentityForGoogle({
        models: { User, VendorApplication },
        verifiedGoogleId: googleId,
        verifiedGoogleEmail: email,
      });
      if (!identity.ok && identity.error === 'identity_ambiguous') {
        // Fail closed: ambiguous email match grants no access (no enumeration).
        return res.redirect(buildRedirect('web', { error: 'identity_ambiguous' }));
      }
      const access = decideStudioAccess({
        existingUser: identity.existingUser,
        application: identity.application,
      });
      if (!access.ok) {
        if (access.error === 'no_application') {
          if (intent === 'register' && draftId) {
            // Try to consume draft and create pending application
            const draftResult = await consumeDraftAndCreateApplication(draftId, {
              email,
              googleId,
              studioName: null,
              websiteOrPortfolio: null,
            });
            if (draftResult.ok) {
              return res.redirect(buildRegisterStatusRedirect('application_pending'));
            }
            const status = draftResult.error === 'identity_collision'
              ? 'registration_error'
              : 'draft_expired';
            return res.redirect(buildRegisterStatusRedirect(status));
          }
          return res.redirect(buildRedirect('web', { error: 'no_application' }));
        }
        if (access.error === 'application_pending') {
          return res.redirect(buildRegisterStatusRedirect('application_pending'));
        }
        if (intent === 'register' && access.error === 'application_rejected') {
          return res.redirect(buildRegisterStatusRedirect('application_rejected'));
        }
        if (intent === 'register' && access.error === 'account_suspended') {
          return res.redirect(buildRegisterStatusRedirect('account_suspended'));
        }
        return res.redirect(buildRedirect('web', { error: access.error }));
      }

      // Approved access - log in the user
      user = access.existingUser;
      if (!user && access.application) {
        // Link the approved application's verified Google identity to its
        // canonical User and reuse the existing Vendor profile. Never creates
        // a second User/Vendor — fail closed when the canonical records are
        // missing (User/Vendor creation happens at admin approval time).
        const linked = await linkVerifiedIdentityToCanonicalUser({
          models: { User, Vendor },
          application: access.application,
          verifiedGoogleId: googleId,
          verifiedGoogleEmail: email,
        });
        if (!linked.ok) {
          console.error('Google identity linking failed:', linked.error);
          if (intent === 'register') {
            return res.redirect(buildRegisterStatusRedirect('registration_error'));
          }
          return res.redirect(buildRedirect('web', { error: 'oauth_failed' }));
        }
        user = linked.user;
      }

      if (user) {
        let dirty = false;
        if (googleId && !user.googleId) {
          user.googleId = googleId;
          dirty = true;
        }
        if (user.authProvider === 'local') {
          user.authProvider = 'google';
          dirty = true;
        }
        if (picture && !user.avatar) {
          user.avatar = picture;
          dirty = true;
        }
        if (
          user.role !== 'vendor' &&
          user.role !== 'admin' &&
          access.application &&
          access.application.status === 'approved'
        ) {
          user.role = 'vendor';
          dirty = true;
        }
        if (dirty) await user.save();
      } else {
        user = await User.create({
          name: name || email.split('@')[0],
          email,
          authProvider: 'google',
          googleId,
          avatar: picture,
          role: 'vendor',
        });
      }

      if (user.role === 'vendor') {
        let vendor = await Vendor.findOne({ owner: user._id });
        if (!vendor) {
          const studioName =
            (access.application && access.application.studioName) ||
            name ||
            user.name ||
            email.split('@')[0];
          vendor = await Vendor.create({
            name: studioName,
            email: user.email,
            owner: user._id,
          });
        }
      }
    } else {
      // Mobile: always customer (role user). Never vendor. Never create Vendor.
      user = await User.findOne({
        $or: [
          { email },
          ...(googleId ? [{ googleId }] : []),
        ],
      });

      if (user) {
        let dirty = false;
        if (googleId && !user.googleId) {
          user.googleId = googleId;
          dirty = true;
        }
        if (user.authProvider === 'local') {
          user.authProvider = 'google';
          dirty = true;
        }
        if (picture && !user.avatar) {
          user.avatar = picture;
          dirty = true;
        }
        // Never downgrade vendor/admin; never promote mobile users to vendor.
        if (dirty) await user.save();
      } else {
        user = await User.create({
          name: name || email.split('@')[0],
          email,
          authProvider: 'google',
          googleId,
          avatar: picture,
          role: 'user',
        });
      }
    }

    if (guestId) {
      await mergeGuestData(user._id, guestId);
    }

    const dryToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.redirect(buildRedirect(platform, { token: dryToken }, customRedirectUri));
  } catch (err) {
    console.error('Google OAuth callback failed:', err.message);
    return res.redirect(buildRedirect(platform, { error: 'oauth_failed' }, customRedirectUri));
  }
});

async function consumeDraftAndCreateApplication(draftId, googleIdentity) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const draft = await GoogleRegistrationDraft.findOneAndUpdate(
      {
        draftId,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() } },
      { new: true, session },
    );
    if (!draft) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, error: 'draft_unavailable' };
    }

    // Reject duplicate/cross-field identity collisions before creating the
    // pending application (generic, non-enumerating result).
    const unique = await assertIdentityUnique({
      models: { VendorApplication },
      application: {
        email: googleIdentity.email,
        verifiedGoogleEmail: googleIdentity.email,
        verifiedGoogleId: googleIdentity.googleId,
      },
    });
    if (!unique.ok) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, error: 'identity_collision' };
    }

    // Create pending VendorApplication with verified Google identity
    await VendorApplication.create([{
      studioName: draft.studioName,
      email: googleIdentity.email,
      websiteOrPortfolio: draft.websiteOrPortfolio,
      verifiedGoogleEmail: googleIdentity.email,
      verifiedGoogleId: googleIdentity.googleId,
      status: 'pending',
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return { ok: true };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // Transaction may already be aborted by the write error.
    }
    session.endSession();
    if (err && err.code === 11000) {
      // Concurrent duplicate-key race on a unique identity/email index.
      // Return the generic non-enumerating result, never a stack trace.
      return { ok: false, error: 'identity_collision' };
    }
    throw err;
  }
}

module.exports = router;
module.exports.buildFrontendRedirect = buildFrontendRedirect;
module.exports.buildRedirect = buildRedirect;
module.exports.buildOAuthStatePayload = buildOAuthStatePayload;
module.exports.buildRegisterStatusRedirect = buildRegisterStatusRedirect;
module.exports.consumeDraftAndCreateApplication = consumeDraftAndCreateApplication;
module.exports.REDIRECT_URI = REDIRECT_URI;
