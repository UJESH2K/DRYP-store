/**
 * requireEmailConfig.js
 *
 * Middleware that blocks email-dependent routes with a clear 503 when
 * SMTP is unconfigured. Returns the same shape the frontend already
 * handles ({ message }).
 *
 * Why this exists:
 *   - Before, an unconfigured SMTP would surface as a 500 mid-handler with
 *     the raw nodemailer error. Worse: the vendor application was already
 *     approved in the DB, but the email never went out, and the vendor
 *     never knew. Inconsistent state.
 *   - Phase 1A/1B moves that boundary up to a clear 503 with an actionable
 *     message: "Email is not configured — ask an admin to set SMTP_*"
 *     and the route is rejected BEFORE any DB write happens.
 *
 * Behavior in development:
 *   - In dev, log a warning and pass through (so local dev without email
 *     creds still works). We don't want to break local hacking.
 *
 * Behavior in production:
 *   - 503 + { message: "...", code: "EMAIL_NOT_CONFIGURED" }
 *
 * Usage:
 *   router.post('/approve', requireAdmin, requireEmailConfig, async (req, res) => { ... });
 */

const logger = require("../utils/logger");

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_EMAIL &&
      process.env.SMTP_PASSWORD,
  );
}

function requireEmailConfig(req, res, next) {
  if (isEmailConfigured()) {
    return next();
  }

  if (process.env.NODE_ENV !== "production") {
    // Dev: warn + pass through. We still want local hacking to work
    // without forcing the user to set up SMTP just to test an unrelated
    // flow.
    logger.warn(
      { path: req.path, method: req.method },
      "email_not_configured_dev_passthrough",
    );
    return next();
  }

  // Production: hard 503. The frontend's apiCall() will surface the
  // message, and the admin can fix SMTP without leaving a half-applied
  // application in Mongo.
  return res.status(503).json({
    code: "EMAIL_NOT_CONFIGURED",
    message:
      "Email is not configured on the server. Set SMTP_HOST, SMTP_EMAIL, " +
      "and SMTP_PASSWORD in the backend .env, then redeploy. No application " +
      "was created.",
  });
}

module.exports = requireEmailConfig;
module.exports.isEmailConfigured = isEmailConfigured;
