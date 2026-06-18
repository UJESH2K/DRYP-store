/**
 * ShopifyConnection.js — Phase 3C. Per-vendor Shopify integration.
 *
 * One ShopifyConnection document per vendor who opts in.
 * Stores the OAuth2 access token, shop domain, and the most-recent
 * sync state. Tokens are never exposed via the public API; routes
 * strip them before sending.
 *
 * Used by:
 *  - 3D: stock sync (read product IDs, push our stock)
 *  - 3E: live stock check at checkout (read inventory_levels)
 *  - 3F: error handling + circuit breaker
 */
const mongoose = require('mongoose');

const SyncStateSchema = new mongoose.Schema({
  lastSyncAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  // simple circuit-breaker
  consecutiveFailures: { type: Number, default: 0 },
  circuitOpenUntil: { type: Date, default: null },
}, { _id: false });

const ShopifyConnectionSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  shop: { type: String, required: true, trim: true }, // e.g. "my-shop.myshopify.com"
  accessToken: { type: String, required: true }, // shopify access token
  scope: { type: String, default: '' }, // granted scopes, comma-separated
  // mapping: which DRYP products correspond to which Shopify variant GIDs
  productMap: { type: Map, of: String, default: {} },
  sync: { type: SyncStateSchema, default: () => ({}) },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Never return the access token in JSON
ShopifyConnectionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.accessToken;
    return ret;
  },
});

module.exports = mongoose.model('ShopifyConnection', ShopifyConnectionSchema);