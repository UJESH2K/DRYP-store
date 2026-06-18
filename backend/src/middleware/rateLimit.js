/**
 * Per-route rate limiters.
 *
 *   import { authLimiter, vendorSignupLimiter, productsLimiter,
 *            cartLimiter, likesLimiter, wishlistLimiter } from
 *             './middleware/rateLimit';
 *
 * express-rate-limit is the underlying lib. We define each
 * limiter in one place so the policy is visible in one file —
 * no longer scattered across server.js.
 */
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                  // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Try again in 15 minutes.' },
});

const vendorSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 5,                   // 5 applications per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many applications from this device. Try again in an hour.' },
});

const productsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const cartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const likesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const wishlistLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const reviewCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 reviews per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You can only post 10 reviews per hour. Try again later.' },
});

module.exports = {
  authLimiter,
  vendorSignupLimiter,
  productsLimiter,
  cartLimiter,
  likesLimiter,
  wishlistLimiter,
  reviewCreateLimiter,
};