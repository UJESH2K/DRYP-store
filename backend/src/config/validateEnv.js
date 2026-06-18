/**
 * validateEnv.js
 *
 * Boot-time environment-variable validation. Runs BEFORE the rest of the app
 * (specifically before any route handler that depends on JWT_SECRET, MONGO_URI,
 * or PORT). If a required env var is missing or malformed, the process exits
 * with a clear error message — not a 500 at runtime.
 *
 * Why this exists:
 *  - `routes/auth.js` used to sign JWTs with `process.env.JWT_SECRET || 'secret'`,
 *    which is a textbook security footgun. Now there is no fallback.
 *  - The app used to boot without MONGO_URI and 500 on every query, which hides
 *    outages on AWS. Now it fails fast at boot.
 *
 * Usage:
 *   require('./config/validateEnv')({ exitOnError: true });
 *   // ...or to get the parsed config object:
 *   const env = require('./config/validateEnv')({ exitOnError: false });
 */

const REQUIRED = {
  MONGO_URI: {
    description: 'MongoDB connection string (e.g. mongodb://127.0.0.1:27017/dryp)',
    validate: (v) => (v && v.length > 0 ? null : 'MONGO_URI is empty'),
  },
  JWT_SECRET: {
    description: 'Random secret used to sign auth tokens. Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    // Reject the literal string 'secret' — that was the old fallback and we
    // never want to ship it.
    validate: (v) => {
      if (!v) return 'JWT_SECRET is empty';
      if (v === 'secret') return 'JWT_SECRET is set to the literal string "secret" — this is the dev placeholder, not a real secret';
      if (v.length < 32) return `JWT_SECRET is too short (${v.length} chars). Use at least 32 chars of random data.`;
      return null;
    },
  },
};

const OPTIONAL = {
  PORT: { default: 8080, parse: (v) => parseInt(v, 10) },
  NODE_ENV: { default: 'development', parse: (v) => v },
  NEXT_PUBLIC_FRONTEND_URL: { default: 'http://localhost:3000', parse: (v) => v },
  FROM_NAME: { default: 'DRYP', parse: (v) => v },
  FROM_EMAIL: { default: 'no-reply@dryp.com', parse: (v) => v },
  // Email service (Phase 1A will switch to Resend, but for now support both)
  SMTP_HOST: { default: null, parse: (v) => v || null },
  SMTP_PORT: { default: 587, parse: (v) => (v ? parseInt(v, 10) : 587) },
  SMTP_EMAIL: { default: null, parse: (v) => v || null },
  SMTP_PASSWORD: { default: null, parse: (v) => v || null },
  // Payments
  RAZORPAY_KEY_ID: { default: null, parse: (v) => v || null },
  RAZORPAY_KEY_SECRET: { default: null, parse: (v) => v || null },
  // Observability (Phase 0D will add Sentry)
  SENTRY_DSN: { default: null, parse: (v) => v || null },
};

function validateEnv(opts = {}) {
  const { exitOnError = true } = opts;
  const errors = [];
  const config = {};

  // Required
  for (const [key, spec] of Object.entries(REQUIRED)) {
    const value = process.env[key];
    const err = spec.validate(value);
    if (err) {
      errors.push(`  ✗ ${key}: ${err}\n    (${spec.description})`);
    } else {
      config[key] = value;
    }
  }

  // Optional
  for (const [key, spec] of Object.entries(OPTIONAL)) {
    const value = process.env[key];
    config[key] = spec.parse ? spec.parse(value) : value;
  }

  if (errors.length > 0) {
    const message =
      `\n❌ Backend startup aborted — invalid environment configuration:\n\n` +
      errors.join('\n\n') +
      `\n\nFix the values in your .env file (see backend/.env.example) and try again.`;

    if (exitOnError) {
      // eslint-disable-next-line no-console
      console.error(message);
      process.exit(1);
    } else {
      throw new Error(message);
    }
  }

  // Sanity check: warn (don't fail) if email is unconfigured, but the user is
  // in production. Forgot-password will 500 in that case (Phase 1A fixes it
  // with a clear guard, Phase 1B extends the guard to vendor routes).
  if (config.NODE_ENV === 'production') {
    const hasSmtp = config.SMTP_HOST && config.SMTP_EMAIL && config.SMTP_PASSWORD;
    if (!hasSmtp) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  Email is not configured (SMTP_HOST/SMTP_EMAIL/SMTP_PASSWORD are empty).\n` +
        `   Forgot-password and vendor approval emails will fail in production.\n` +
        `   Phase 1A will switch to Resend. Set RESEND_API_KEY or the SMTP_* vars.`,
      );
    }
  }

  return config;
}

module.exports = validateEnv;
module.exports.REQUIRED = REQUIRED;
module.exports.OPTIONAL = OPTIONAL;
