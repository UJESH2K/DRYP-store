/**
 * sentry.js
 *
 * Optional Sentry initialization. If SENTRY_DSN is unset (or @sentry/node
 * isn't installed), this is a no-op. If SENTRY_DSN is set, we init Sentry
 * with our pino-style structured logger and capture uncaught exceptions /
 * unhandled promise rejections so the AWS box doesn't die silently.
 *
 * Why this exists:
 *   - The previous setup logged fatal errors to console and called process.exit(1)
 *     in one place, and silently swallowed them everywhere else. Production
 *     errors were invisible until users complained.
 *
 * Setup:
 *   1. `npm install @sentry/node` inside backend/
 *   2. Set SENTRY_DSN in your .env (get one at sentry.io)
 *   3. require('./config/sentry')() at the very top of server.js
 *
 * The require is lazy so we don't crash in environments where the package
 * isn't installed (dev, CI, pre-deploy probes).
 */

const logger = require("../utils/logger");

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("sentry_disabled_no_dsn");
    return null;
  }

  let Sentry;
  try {
    Sentry = require("@sentry/node");
  } catch (err) {
    logger.warn(
      { err: err.message },
      "sentry_dsn_set_but_package_not_installed",
    );
    return null;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't send PII to Sentry by default — passwords, tokens, etc.
    // If you need a specific value, sanitize it before throwing.
    beforeSend(event) {
      // Strip request body entirely — it may contain login credentials.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });

  logger.info({ environment: process.env.NODE_ENV }, "sentry_initialized");
  return Sentry;
}

module.exports = initSentry;
