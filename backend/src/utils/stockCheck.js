/**
 * stockCheck.js — Phase 3B. Pre-checkout stock validator.
 *
 * Given a list of cart items, verifies:
 *  1. The product still exists.
 *  2. The variant / simple stock (minus active holds) is ≥ quantity.
 *  3. If the vendor has a Shopify connection, the live inventory is
 *     not lower than our DB number (Phase 3E). The lower of the two
 *     wins — we never promise more than what's actually available.
 *
 * Returns:
 *   { ok, issues: [{ productId, options, requested, available, source }] }
 *
 * Source values: 'db' | 'shopify'
 *
 * The route calls this BEFORE creating the order, and if !ok returns
 * 409 with the issues so the client can prompt the user to adjust.
 */

const reservation = require('./stockReservation');
const ShopifyConnection = require('../models/ShopifyConnection');
const shopify = require('./shopifyClient');

async function checkOne(product, options, requested) {
  // DB-side stock minus active holds
  const dbAvailable = await reservation.availableStock(product, options);

  // Optional live Shopify check (best-effort, non-blocking if
  // the circuit is open — fetchInventory returns null).
  const vendorId = product.vendor && product.vendor.toString();
  if (vendorId) {
    const conn = await ShopifyConnection.findOne({ vendor: vendorId }).lean();
    if (conn && conn.enabled) {
      const live = await shopify.fetchInventory(conn, options);
      if (typeof live === 'number') {
        return {
          available: Math.min(dbAvailable, live),
          source: 'shopify',
        };
      }
    }
  }
  return { available: dbAvailable, source: 'db' };
}

async function validate(items, products) {
  // items: [{ productId, options, quantity }]
  // products: matching Product docs (already loaded by the route)
  const issues = [];
  for (const item of items) {
    const product = products.find((p) => p._id.toString() === item.productId);
    if (!product) {
      issues.push({
        productId: item.productId,
        options: item.options || {},
        requested: Math.max(1, parseInt(item.quantity, 10) || 1),
        available: 0,
        source: 'db',
        reason: 'product_unavailable',
      });
      continue;
    }
    const requested = Math.max(1, parseInt(item.quantity, 10) || 1);
    const { available, source } = await checkOne(product, item.options || {}, requested);
    if (available < requested) {
      issues.push({
        productId: item.productId,
        options: item.options || {},
        requested,
        available,
        source,
        reason: 'insufficient_stock',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

module.exports = { validate, checkOne };