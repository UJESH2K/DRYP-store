/**
 * users.js — request schemas for /api/users/*.
 *
 * User account management: profile updates, address book, password
 * change, account deletion.
 */

const { z } = require('zod');
const { objectId, email, name, role } = require('./common');

// Long-form free text. Cap at 5000 chars; adjust if the model grows.
const longText = z.string().trim().max(5000).optional();

// An address sub-document, matching the embedded `addresses` array in
// src/models/User.js. Used for both create and update.
const address = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
  isDefault: z.boolean().default(false),
});

/**
 * PATCH /api/users/me
 *   body: { name?, email?, phone?, preferences?, addresses? }
 */
const updateMe = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: z.string().trim().min(8).max(30).optional(),
    preferences: z
      .object({
        categories: z.array(z.string()).optional(),
        sizes: z.array(z.string()).optional(),
        colors: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    addresses: z.array(address).optional(),
  })
  .strict();

/**
 * POST /api/users/me/addresses
 *   body: Address (no `id`)
 */
const addAddress = address.strict();

/**
 * PATCH /api/users/me/addresses/:id
 *   body: Partial<Address>
 */
const updateAddress = z
  .object({
    label: z.string().trim().min(1).max(50).optional(),
    street: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    zipCode: z.string().trim().min(1).max(20).optional(),
    country: z.string().trim().min(1).max(100).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/users/me/password
 *   body: { currentPassword, newPassword }
 */
const changePassword = z
  .object({
    currentPassword: z.string().min(1, 'current password is required'),
    newPassword: z
      .string()
      .min(8, 'new password must be at least 8 characters')
      .max(128, 'new password must be at most 128 characters')
      .refine((v) => /[A-Z]/.test(v), 'new password must contain an uppercase letter')
      .refine((v) => /[a-z]/.test(v), 'new password must contain a lowercase letter')
      .refine((v) => /[0-9]/.test(v), 'new password must contain a digit'),
  })
  .strict();

/**
 * PATCH /api/users/:id/role — admin-only.
 *   body: { role }
 */
const setRole = z
  .object({
    role,
  })
  .strict();

const idParam = z.object({ id: objectId });

module.exports = {
  updateMe,
  addAddress,
  updateAddress,
  changePassword,
  setRole,
  idParam,
};