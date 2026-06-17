/**
 * auth.js — request schemas for /api/auth/*.
 *
 * Each exported schema is the body shape for one route. The router in
 * src/routes/auth.js picks the right one and pairs it with the
 * `validate()` middleware.
 *
 * Rules-of-thumb for these schemas:
 *   - `email` and `password` use the shared primitives from common.js.
 *     This guarantees the rules on the client (Phase 4G) match the
 *     server exactly.
 *   - We use `passthrough()` for any field we don't constrain, so the
 *     handler can decide whether to use it. The default mode is
 *     `strip`, which would silently drop fields the client sends.
 *   - All strings are .trim()-ed at the schema level so handlers don't
 *     have to remember to do it themselves.
 */

const { z } = require('zod');
const { email, password, name, guestId } = require('./common');

/**
 * POST /api/auth/register
 *   body: { name, email, password, guestId? }
 */
const register = z
  .object({
    name,
    email,
    password,
    guestId,
  })
  .strict();

/**
 * POST /api/auth/login
 *   body: { email, password, guestId? }
 *
 * Note: `password` here uses the SHAPE of the password schema (8+
 * chars etc.) but the actual *login* is allowed for any password the
 * client sends. We use a looser `min(1)` so login doesn't 400 on a
 * password that's "weak" by the registration rule but matches the
 * user's existing hash. Without this, an old account with a 6-char
 * password would be permanently locked out after we ship the new
 * validator.
 *
 * Alternative considered: check strength only on register, not on
 * login. We're taking the alternative: the server doesn't enforce
 * password strength on login attempts. It just checks length ≥ 1.
 */
const loginPassword = z.string().min(1, 'password is required').max(128);

const login = z
  .object({
    email,
    password: loginPassword,
    guestId,
  })
  .strict();

/**
 * POST /api/auth/forgot-password
 *   body: { email }
 */
const forgotPassword = z
  .object({
    email,
  })
  .strict();

/**
 * PUT /api/auth/reset-password/:token
 *   params: { token: <20-byte hex from email URL> }
 *   body:   { password }
 *
 * The token comes from the URL in the email and is a 40-char hex
 * string (20 random bytes hex-encoded in routes/auth.js). Validating
 * the shape here lets us 400 on a malformed token instead of running
 * an empty SHA-256 hash and looking it up against the DB.
 */
const resetTokenParam = z.object({
  token: z
    .string()
    .regex(/^[0-9a-f]{40}$/, 'reset token must be 40 hex characters'),
});

const resetPassword = z
  .object({
    password,
  })
  .strict();

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  resetTokenParam,
};
