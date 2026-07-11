const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { mergeGuestData } = require('./auth');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.SHOPIFY_APP_URL || 'http://localhost:8080'}/api/auth/google/callback`;

const buildFrontendRedirect = (params) => {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const query = new URLSearchParams(params).toString();
  return `${base}/oauth/google/callback?${query}`;
};

// @route   GET /api/auth/google
// @desc    Redirect to Google OAuth consent page
// @access  Public
router.get('/', (req, res) => {
  const { guestId } = req.query;

  const state = jwt.sign(
    { guestId: guestId || null },
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

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// @route   GET /api/auth/google/callback
// @desc    Handle Google OAuth callback, create/login user
// @access  Public (Google redirect)
router.get('/callback', async (req, res, next) => {
  const { code, state: stateParam, error } = req.query;

  if (error) {
    return res.redirect(buildFrontendRedirect({ error: 'google_denied' }));
  }

  if (!code) {
    return res.redirect(buildFrontendRedirect({ error: 'no_code' }));
  }

  let state;
  try {
    state = jwt.verify(stateParam, process.env.JWT_SECRET);
  } catch {
    return res.redirect(buildFrontendRedirect({ error: 'invalid_state' }));
  }

  try {
    // Exchange authorization code for tokens
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
      return res.redirect(buildFrontendRedirect({ error: 'token_exchange_failed' }));
    }

    // Fetch user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();
    if (!googleUser.email) {
      return res.redirect(buildFrontendRedirect({ error: 'no_email' }));
    }

    const { email, name, picture } = googleUser;

    // Find existing user or create new one
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Update authProvider if it was 'local' — upgrade to google
      if (user.authProvider === 'local') {
        user.authProvider = 'google';
        if (picture && !user.avatar) user.avatar = picture;
        await user.save();
      }
    } else {
      // Create new user
      isNewUser = true;
      const createdUsers = await User.create({
        name: name || email.split('@')[0],
        email,
        authProvider: 'google',
        avatar: picture,
        role: 'vendor',
      });
      user = createdUsers[0];

      // Create a vendor profile for new users
      await Vendor.create({
        name: name || email.split('@')[0],
        email,
        owner: user._id,
      });
    }

    // Merge guest data if a guestId was provided
    if (state.guestId) {
      await mergeGuestData(user._id, state.guestId);
    }

    const dryToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.redirect(buildFrontendRedirect({ token: dryToken }));
  } catch (error) {
    console.error('Google OAuth callback failed:', error.message);
    return res.redirect(buildFrontendRedirect({ error: 'oauth_failed' }));
  }
});

module.exports = router;
