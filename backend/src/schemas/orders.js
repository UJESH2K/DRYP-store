/**
 * orders.js — request schemas for /api/orders/*.
 *
 * Orders are typically created server-side from the cart (no client
 * request body beyond an address). These schemas cover the few inputs
 * the API accepts: shipping address, status updates by admin, and
 * the by-id param.
 */

const { z } = require('zod');
const { objectId } = require('./common');

const longText = z.string().trim().max(5000).optional();

/**
 * Address. Same shape as the embedded address in User.addresses and
 * Vendor.address — we accept it as part of the checkout body rather
 * than reading it back from the user record, because guests can
 * check out (using a saved `x-guest-id`).
 */
const address = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
});

/**
 * POST /api/orders — create order from current cart.
 *   body: { shippingAddress, paymentMethodId?, notes? }
 */
const create = z
  .object({
    shippingAddress: address,
    paymentMethodId: z.string().trim().min(1).max(100).optional(),
    notes: longText,
  })
  .strict();

/**
 * PATCH /api/orders/:id/status — admin updates.
 *   body: { status }
 */
const updateStatus = z
  .object({
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  })
  .strict();

const idParam = z.object({ id: objectId });

module.exports = {
  create,
  updateStatus,
  idParam,
};