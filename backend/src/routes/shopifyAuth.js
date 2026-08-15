const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const VendorApplication = require('../models/VendorApplication');
const agenda = require('../config/agenda');
const { encrypt } = require('../utils/crypto');
const { shopifyGraphQL } = require('../utils/shopifyClient');
const {
  isValidShopDomain,
  buildAuthorizeUrl,
  verifyHmac,
  exchangeCodeForToken,
} = require('../utils/shopifyOAuth');

let _shopifyConfigError = null;
if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
  _shopifyConfigError = new Error(
    'Shopify integration is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET in the backend .env file.'
  );
}

const PLATFORMS = ['web', 'mobile'];

const buildRedirectUrl = (platform, params) => {
  const query = new URLSearchParams(params).toString();
  if (platform === 'mobile') return `dryp://oauth-callback?${query}`;
  const { frontendUrl } = require('../utils/frontendUrl');
  return `${frontendUrl()}/oauth/shopify/callback?${query}`;
};

router.get('/start', (req, res) => {
  const { shop, platform, token } = req.query;
  const redirectPlatform = PLATFORMS.includes(platform) ? platform : 'web';

  if (_shopifyConfigError) {
    return res.redirect(buildRedirectUrl(redirectPlatform, { error: 'shopify_not_configured' }));
  }

  if (!isValidShopDomain(shop)) {
    return res.redirect(buildRedirectUrl(redirectPlatform, { error: 'invalid_shop' }));
  }
  if (!PLATFORMS.includes(platform)) {
    return res.redirect(buildRedirectUrl(redirectPlatform, { error: 'invalid_platform' }));
  }

  let userId;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      // Ignore an invalid/expired token — continue as an anonymous OAuth start.
    }
  }

  const state = jwt.sign(
    { shop, platform, userId },
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );

  res.redirect(buildAuthorizeUrl({ shop, state }));
});

router.get('/callback', async (req, res, next) => {
  const { shop, code } = req.query;

  if (!verifyHmac(req.query)) {
    if (_shopifyConfigError) {
      return res.status(500).json({ message: 'Shopify integration is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET in the backend .env.' });
    }
    return res.status(400).json({ message: 'Invalid Shopify request signature.' });
  }

  let state;
  try {
    state = jwt.verify(req.query.state, process.env.JWT_SECRET);
  } catch {
    return res.status(400).json({ message: 'Invalid or expired OAuth state.' });
  }

  const { platform, userId } = state;
  if (state.shop !== shop || !isValidShopDomain(shop)) {
    return res.status(400).json({ message: 'Shop mismatch in OAuth callback.' });
  }

  if (_shopifyConfigError) {
    return res.redirect(buildRedirectUrl(platform || 'web', { error: 'shopify_not_configured' }));
  }

  const redirect = (params) => res.redirect(buildRedirectUrl(platform, params));

  try {
    const { access_token: accessToken, scope } = await exchangeCodeForToken({ shop, code });

    const shopData = await shopifyGraphQL(shop, accessToken, '{ shop { name email } }');
    const shopName = shopData.shop.name;
    const shopEmail = shopData.shop.email;

    let user;
    let vendor;

    if (userId) {
      // Already-authenticated vendor connecting their store to their existing account.
      user = await User.findById(userId);
      if (!user) return redirect({ error: 'invalid_session' });

      vendor = await Vendor.findOne({ owner: user._id });
      if (!vendor) return redirect({ error: 'no_vendor_profile' });
    } else {
      // Anonymous OAuth start — either a re-auth of an already-linked store,
      // or a brand-new vendor sign-up.
      vendor = await Vendor.findOne({ 'shopify.shopDomain': shop });

      if (vendor) {
        user = await User.findById(vendor.owner);
      } else {
        const existingUser = await User.findOne({ email: shopEmail });
        if (existingUser) {
          // Never silently attach an anonymous OAuth sign-in to an existing account —
          // that would let anyone with control of a Shopify store's contact email
          // take over a DRYP account. Require them to log in and connect manually.
          return redirect({ error: 'account_exists' });
        }

        // Gate: an anonymous Shopify OAuth start may only create a vendor
        // account when an application has been approved for this email. This
        // mirrors the approval policy enforced in /api/vendors/register and
        // the Google OAuth callback (decideStudioAccess).
        const normalizedEmail = String(shopEmail || '').toLowerCase().trim();
        const approvedApplication = await VendorApplication.findOne({
          $or: [{ email: normalizedEmail }, { googleEmail: normalizedEmail }],
          status: 'approved',
        });
        if (!approvedApplication) {
          return redirect({ error: 'no_application' });
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const createdUsers = await User.create(
            [{ name: shopName, email: shopEmail, role: 'vendor', authProvider: 'shopify' }],
            { session },
          );
          user = createdUsers[0];

          const createdVendors = await Vendor.create(
            [{ name: shopName, email: shopEmail, owner: user._id }],
            { session },
          );
          vendor = createdVendors[0];

          await session.commitTransaction();
        } catch (transactionError) {
          await session.abortTransaction();
          throw transactionError;
        } finally {
          session.endSession();
        }
      }
    }

    vendor.shopify = {
      shopDomain: shop,
      accessTokenEnc: encrypt(accessToken),
      scope,
      connectedAt: new Date(),
      importStatus: 'pending',
      importError: undefined,
    };
    await vendor.save();

    await agenda.now('shopify:start-bulk-import', { vendorId: vendor._id.toString() });

    const dryToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return redirect({ token: dryToken });
  } catch (error) {
    console.error('Shopify OAuth callback failed:', error.message);
    return redirect({ error: 'oauth_failed' });
  }
});

module.exports = router;
