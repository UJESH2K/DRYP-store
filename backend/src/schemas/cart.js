/**
 * cart.js — request schemas for /api/cart/*.
 *
 * Cart operations are typically two-body: identify a product variant,
 * and a quantity. Items are stored on a Cart doc keyed by the user's
 * ID or `x-guest-id`.
 */

const { z } = require('zod');
const { objectId } = require('./common');

/**
 * POST /api/cart/items
 *   body: { productId, options?, quantity }
 */
const addItem = z
  .object({
    productId: objectId,
    options: z.record(z.string(), z.string()).default({}),
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .strict();

/**
 * PATCH /api/cart/items/:productId
 *   body: { quantity }
 *
 * `options` is part of the URL pattern in the current implementation
 * (encoded in the path or header). Adjust as needed.
 */
const updateItem = z
  .object({
    quantity: z.number().int().min(0).max(99),
  })
  .strict();

const productIdParam = z.object({ productId: objectId });

module.exports = {
  addItem,
  updateItem,
  productIdParam,
};