/**
 * common.js — shared zod primitives and helpers.
 *
 * Why this file:
 *   Schemas for common types (ObjectId, email, password, role) are referenced
 *   from many route schemas. Defining them once keeps the constraints
 *   consistent — if we tighten the password rule, every route that uses
 *   `passwordSchema` updates at once.
 */

const { z } = require('zod');

/**
 * Mongo ObjectId — 24 hex chars. We use this on `req.params.id` and on
 * fields in body that we hand to mongoose. Trying to pass a non-hex
 * string to `findById('foo')` was the source of multiple 500s — this
 * schema catches that at the request boundary.
 */
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'must be a 24-character hex string (Mongo ObjectId)');

/**
 * Email — RFC 5322-lite. We don't try to be a full validator; we just
 * want a reasonable filter. The User model has a unique index on email
 * so the DB will catch exact duplicates.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'email is too short')
  .max(254, 'email is too long')
  .email('invalid email');

/**
 * Password rule. Mirrors `isValidPassword()` in routes/auth.js so the
 * rules don't diverge. Required: 8+ chars, upper, lower, digit.
 */
const password = z
  .string()
  .min(8, 'password must be at least 8 characters')
  .max(128, 'password must be at most 128 characters')
  .refine((v) => /[A-Z]/.test(v), 'password must contain an uppercase letter')
  .refine((v) => /[a-z]/.test(v), 'password must contain a lowercase letter')
  .refine((v) => /[0-9]/.test(v), 'password must contain a digit');

/**
 * User-supplied name (display name, vendor name, etc). Looser than
 * `email` because names can contain unicode, spaces, and so on.
 */
const name = z.string().trim().min(1, 'name is required').max(100, 'name is too long');

/**
 * Guest ID. We accept any non-empty string up to 128 chars. The frontend
 * generates these as UUIDs but the schema intentionally doesn't require
 * UUID-shape — old client builds may emit different formats, and the
 * server has never validated this.
 */
const guestId = z.string().min(1).max(128).optional();

/**
 * Role enum. Mirrors the `role` enum on the User model.
 */
const role = z.enum(['user', 'vendor', 'admin']);

/**
 * Pagination params (page + limit, used in query strings). Coerces
 * strings to numbers, applies bounds.
 */
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  objectId,
  email,
  password,
  name,
  guestId,
  role,
  pagination,
};
