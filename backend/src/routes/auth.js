const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Like = require('../models/Like');
const WishlistItem = require('../models/WishlistItem');
const Order = require('../models/Order');
const router = express.Router();
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/auth');
const requireEmailConfig = require('../middleware/requireEmailConfig');
const logger = require('../utils/logger');

const mergeGuestData = async (userId, guestId) => {
  if (!guestId) return;
  try {
    // Merge likes, avoiding duplicates
    const guestLikes = await Like.find({ guestId });
    const userLikes = await Like.find({ user: userId });
    const userLikedProductIds = new Set(userLikes.map(l => l.product.toString()));

    for (const like of guestLikes) {
      if (!userLikedProductIds.has(like.product.toString())) {
        like.user = userId;
        like.guestId = null;
        await like.save();
      } else {
        await Like.findByIdAndDelete(like._id);
      }
    }
    
    // Merge wishlist, avoiding duplicates
    const guestWishlistItems = await WishlistItem.find({ guestId });
    const userWishlistItems = await WishlistItem.find({ user: userId });
    const userWishlistProductIds = new Set(userWishlistItems.map(i => i.product.toString()));

    for (const item of guestWishlistItems) {
      if (!userWishlistProductIds.has(item.product.toString())) {
        item.user = userId;
        item.guestId = null;
        await item.save();
      } else {
        await WishlistItem.findByIdAndDelete(item._id);
      }
    }
    
    // Merge orders (cart)
    await Order.updateMany({ guestId, status: 'cart' }, { user: userId, guestId: null });

  } catch (error) {
    console.error(`Error merging guest data for user ${userId} from guest ${guestId}:`, error);
  }
};


// POST /api/auth/register
router.post('/register', validate({ body: schemas.register }), async (req, res, next) => {
  try {
    // Body has already been validated and trimmed by the zod schema.
    const { name, email, password, guestId } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    await mergeGuestData(user._id, guestId);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.json({ token, user: userObj });
  } catch (error) { next(error); }
});

// POST /api/auth/login
router.post('/login', validate({ body: schemas.login }), async (req, res, next) => {
  try {
    const { email, password, guestId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    await mergeGuestData(user._id, guestId);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (error) { next(error); }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate token and send email
router.post('/forgot-password', requireEmailConfig, validate({ body: schemas.forgotPassword }), async (req, res, next) => {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      logger.error({}, 'forgot_password called but SMTP is not configured');
      return res.status(500).json({
        message: 'Email service is not configured. Please contact support.'
      });
    }

    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      // Security Best Practice: Do not reveal if the email exists or not
      return res.status(200).json({ message: 'If an account exists, a reset email has been sent.' });
    }

    // 1. Generate a raw 20-character crypto token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 2. Hash it and set expiration to 10 minutes from now, then save to DB
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; 
    await user.save();

    // 3. Create the reset URL pointing to your NEXT.JS FRONTEND
    // Ensure NEXT_PUBLIC_FRONTEND_URL is in your .env (e.g., http://localhost:3000)
    const resetUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    // Mobile deep link. The Expo app's `scheme: "dryp"` lets us register
    // dryp://reset-password/<token> as a deep link, and the app's Linking
    // listener will route it to /reset-password/[token] inside the app.
    // This is the iOS-friendly path: tapping the email on a phone opens
    // the app directly instead of bouncing through Safari to the website.
    const mobileResetUrl = `${process.env.MOBILE_RESET_SCHEME || 'dryp://reset-password'}/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. \n\nPlease make a PUT request to: \n\n ${resetUrl}`;

    try {
      // The sleek, mobile-responsive DRYP HTML Email Template
      const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DRYP Password Reset</title>
        <style>
          /* Mobile adjustments */
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 30px 20px !important; }
            .button { width: 100% !important; display: block !important; box-sizing: border-box; }
            .body-text { font-size: 16px !important; line-height: 28px !important; max-width: 100% !important; }
            .title { font-size: 28px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #FCFCFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FCFCFA; padding: 40px 0;">
          <tr>
            <td align="center">
              
              <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 60px 50px;">
                
                <tr>
                  <td align="center" style="padding-bottom: 50px;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; letter-spacing: 12px; color: #000000;">DRYP</h1>
                    <p style="margin: 12px 0 0 0; font-family: Arial, sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 5px; color: #999999;">Vendor Portal</p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 30px;">
                    <h2 class="title" style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; color: #000000;">Recovery Dossier</h2>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 40px;">
                    <p class="body-text" style="margin: 0; font-size: 14px; line-height: 26px; color: #555555; text-align: center; max-width: 85%;">
                      A request has been made to reset the credentials for your studio. Click the link below to securely update your passphrase. This transmission will self-destruct in 10 minutes.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 50px;">
                    <a href="${resetUrl}" class="button" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 4px; padding: 20px 45px; border: 1px solid #000000;">Initialize Reset</a>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 50px;">
                    <p style="margin: 0 0 16px 0; font-size: 9px; color: #999999; text-transform: uppercase; letter-spacing: 3px;">On Mobile?</p>
                    <a href="${mobileResetUrl}" class="button" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 4px; padding: 20px 45px; border: 1px solid #000000;">Open in DRYP App</a>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="border-top: 1px solid #f0f0f0; padding-top: 30px;">
                    <p style="margin: 0; font-size: 9px; color: #bbbbbb; text-transform: uppercase; letter-spacing: 2px; line-height: 18px;">
                      If you did not request this, you may safely ignore this transmission.<br>No changes have been made to your account.
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

      await sendEmail({
        email: user.email,
        subject: 'DRYP | Action Required: Password Recovery',
        message: message, // Keeps the plain-text fallback just in case
        html: emailHTML
      });

      res.status(200).json({ message: 'Email sent' });
    } catch (err) {
      logger.error({ err: err.message }, 'forgot_password: email send failed');
      // If email fails, wipe the token from the DB so they can try again
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) { next(error); }
});

// @route   PUT /api/auth/reset-password/:token
// @desc    Verify token and save new password
router.put(
  '/reset-password/:token',
  validate({ params: schemas.resetTokenParam, body: schemas.resetPassword }),
  async (req, res, next) => {
    try {
      // 1. Re-hash the token from the URL to match what is saved in the DB
      const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

      // 2. Find user by token AND ensure the token hasn't expired
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() } // $gt means "Greater Than" current time
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // 3. The password has already been validated by the zod schema; we
      //    can rely on it being 8+ chars with upper/lower/digit.

      // 4. Hash the new password and update user
      user.passwordHash = await bcrypt.hash(req.body.password, 10);

      // 5. Clear the reset fields so the token can't be reused
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.status(200).json({ message: 'Password successfully reset. You may now log in.' });
    } catch (error) { next(error); }
  },
);

module.exports = router;


