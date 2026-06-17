/**
 * vendors.js — request schemas for /api/vendors/*.
 *
 * Most vendor account management goes through the user routes
 * (POST /api/auth/register, PATCH /api/users/me). The vendor routes
 * expose vendor-studio details: the vendor's name, address, logo,
 * description, etc.
 */

const { z } = require('zod');
const { objectId, email, password, name } = require('./common');

const longText = z.string().trim().max(5000).optional();

/**
 * Address sub-document. Matches the `address` field in
 * src/models/Vendor.js.
 */
const address = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
});

/**
 * POST /api/vendors/login
 *   body: { email, password }
 */
const login = z
  .object({
    email,
    password: z.string().min(1, 'password is required'),
  })
  .strict();

/**
 * POST /api/vendors/register
 *   body: { name, email, password, description?, address?, phone? }
 *   Side effect: creates both a User (role='vendor') and a Vendor doc.
 */
const register = z
  .object({
    name,
    email,
    password,
    description: longText,
    address: address.optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .strict();

/**
 * PATCH /api/vendors/:id — admin updates (e.g. suspend).
 */
const adminUpdate = z
  .object({
    isActive: z.boolean().optional(),
    name: name.optional(),
    description: longText,
  })
  .strict();

const idParam = z.object({ id: objectId });

module.exports = {
  login,
  register,
  adminUpdate,
  idParam,
};