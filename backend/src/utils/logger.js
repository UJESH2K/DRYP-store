/**
 * logger.js
 *
 * Thin wrapper around pino with safe defaults.
 *
 * Why this exists:
 *  - `server.js` used `app.use((req, res, next) => console.log(JSON.stringify(req.body, null, 2)))`
 *    on every request. That meant every login/register/reset put the user's
 *    plaintext password into CloudWatch. This logger redacts those fields by
 *    default so the same diagnostic info can be captured safely.
 *  - pino is fast (1.5x faster than console.log in benchmarks), structured
 *    (JSON in prod, pretty in dev), and has built-in redaction.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info({ userId, route: req.path }, 'request received');
 *   logger.warn({ err }, 'something soft went wrong');
 *   logger.error({ err, stack: err.stack }, 'something hard went wrong');
 *
 * The `req` object is auto-redacted of:
 *   - req.body.password, req.body.passwordHash, req.body.confirmPassword
 *   - req.body.token, req.body.resetToken
 *   - req.headers.authorization, req.headers.cookie
 *   - req.body.*.password (deep paths, all variants)
 */

const isProd = process.env.NODE_ENV === 'production';

// Redaction paths. Pino walks the object and replaces matches with '[Redacted]'.
// Use wildcards to catch nested fields. Each path is repeated with a leading
// `*.` so a logger.info({ password: '...' }) call gets redacted the same way
// as a logger.info({ req: { body: { password: '...' } } }) call.
const REDACT_PATHS = [
  // Auth credentials
  'password',
  'passwordHash',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'oldPassword',
  'token',
  'resetToken',
  'accessToken',
  'refreshToken',
  'idToken',
  'sessionToken',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  // Headers (full header names too, just in case)
  'req.headers.authorization',
  'req.headers.cookie',
  // req.body — top-level and nested
  'req.body.password',
  'req.body.passwordHash',
  'req.body.confirmPassword',
  'req.body.token',
  'req.body.resetToken',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.idToken',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.oldPassword',
  // Wildcards: any depth, any sibling name
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.resetToken',
  '*.accessToken',
  '*.refreshToken',
  '*.authorization',
  '*.cookie',
  // Shopify/encryption keys (Phase 6 — redact now, hard to add later)
  '*.access_token',
  '*.shopifyAccessToken',
  '*.encryptedAccessToken',
];

// We intentionally do not require `pino` from the package.json — it's a dev
// dependency that may not be installed everywhere. We fall back to a no-op
// logger if it's missing so the app doesn't crash on import.
let pino;
try {
  pino = require('pino');
} catch (err) {
  // Fallback: minimal console-based logger with manual redaction.
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  pino is not installed. Run `npm install pino` in backend/. Falling back to a simple console logger.',
  );
  pino = null;
}

let logger;

if (pino) {
  logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: {
      paths: REDACT_PATHS,
      censor: '[Redacted]',
    },
    ...(isProd
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
        }),
  });
} else {
  // Fallback. We don't redact (no pino) but we at least don't crash.
  const noop = () => {};
  logger = {
    fatal: console.error.bind(console, '[FATAL]'),
    error: console.error.bind(console, '[ERROR]'),
    warn: console.warn.bind(console, '[WARN]'),
    info: console.log.bind(console, '[INFO]'),
    debug: console.log.bind(console, '[DEBUG]'),
    trace: noop,
    child: () => logger,
  };
}

module.exports = logger;
