/**
 * sendEmail.js — re-export shim.
 *
 * The real implementation lives in `emailProvider.js` (Phase 1A),
 * which adds Resend support and a unified `isConfigured()` check.
 *
 * Compatibility notes:
 *   - Old callers did `require('../utils/sendEmail')` and got a
 *     function. The new module exports `{ sendEmail, isEmailConfigured, FROM }`.
 *     For the new shape, change `require` to destructure:
 *
 *         const { sendEmail } = require('../utils/sendEmail');
 *
 *   - Until all callers are updated, this file also stays
 *     callable as a function (the default export) — Node will call
 *     it with the options object, which is forwarded to the new
 *     `sendEmail`.
 */

// Lazy-required to avoid a circular dep with emailProvider.
let _impl = null;
function impl() {
  if (_impl) return _impl;
  _impl = require('./emailProvider');
  return _impl;
}

const shim = function sendEmailShim(options) {
  return impl().sendEmail(options);
};

shim.sendEmail = (options) => impl().sendEmail(options);
shim.isEmailConfigured = () => impl().isConfigured();
shim.FROM = () => impl().FROM;

module.exports = shim;
