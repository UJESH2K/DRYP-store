const express = require('express');
const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const router = express.Router();

const User = require('../models/User');
const { mergeGuestData } = require('./auth');
const { normalizeEmail } = require('../utils/studioAccess');

// Sign in with Apple — native mobile flow. The client
// (expo-apple-authentication) returns a signed identityToken; this route
// verifies the signature directly against Apple's public JWKS. No client
// secret, redirect URI, or server-side token exchange is required.
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
// The audience is the Services ID / bundle identifier the token was issued
// for. Native iOS clients receive tokens scoped to the app bundle ID
// (frontend/app.json -> ios.bundleIdentifier).
const APPLE_CLIENT_ID =
  process.env.APPLE_CLIENT_ID ||
  process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ||
  process.env.EXPO_CLIENT_ID ||
  'com.dryp.store';

let appleJWKS = null;
const getAppleJWKS = () => {
  if (!appleJWKS) {
    appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  }
  return appleJWKS;
};

router.post('/', async (req, res, next) => {
  try {
    const { identityToken, fullName } = req.body || {};

    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ message: 'identityToken is required.' });
    }

    // jwtVerify enforces exp; issuer + audience are checked here as well.
    let payload;
    try {
      const { payload: verified } = await jwtVerify(identityToken, getAppleJWKS(), {
        issuer: APPLE_ISSUER,
        audience: APPLE_CLIENT_ID,
      });
      payload = verified;
    } catch (err) {
      console.error('Apple identity token verification failed:', err.message);
      return res.status(401).json({ message: 'Invalid Apple identity token.' });
    }

    const appleId = payload.sub ? String(payload.sub) : null;
    if (!appleId) {
      return res.status(401).json({ message: 'Apple identity token has no subject.' });
    }

    // Apple only includes email (and the native fullName) on the FIRST
    // authorization; later tokens carry only the stable `sub`, so appleId is
    // persisted on first contact and used for lookup afterwards.
    const email = payload.email ? normalizeEmail(payload.email) : null;
    const name =
      fullName && (fullName.givenName || fullName.familyName)
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
        : null;

    // Mobile: always customer (role user). Mirrors the Google mobile branch.
    let user = await User.findOne(
      email ? { $or: [{ appleId }, { email }] } : { appleId },
    );

    if (user) {
      let dirty = false;
      if (!user.appleId) {
        user.appleId = appleId;
        dirty = true;
      }
      if (user.authProvider === 'local') {
        user.authProvider = 'apple';
        dirty = true;
      }
      // Never downgrade vendor/admin; never promote mobile users to vendor.
      if (dirty) await user.save();
    } else {
      if (!email) {
        return res
          .status(400)
          .json({ message: 'No existing account for this Apple identity and no email was provided.' });
      }
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        authProvider: 'apple',
        appleId,
        role: 'user',
      });
    }

    const guestId = (req.body && req.body.guestId) || req.headers['x-guest-id'] || null;
    if (guestId) {
      await mergeGuestData(user._id, guestId);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.json({ token, user: userObj });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
