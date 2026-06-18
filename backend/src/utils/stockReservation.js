/**
 * stockReservation.js — soft stock holds during checkout.
 *
 * Problem: a user can hold 5 items in their cart, but if the actual
 * stock is 3, the order can only be partially fulfilled. Right now we
 * let the user check out and only discover the shortage at order
 * creation, which produces a confusing 409 / partial charge.
 *
 * Solution: when a user adds an item to cart, hold a "reservation"
 * against the variant's stock. The hold expires after a TTL
 * (default 10 min — long enough to complete checkout, short enough
 * that abandoned carts free the stock back up).
 *
 * Stores
 *  - dev: in-process Map (lost on restart, but works without Redis)
 *  - prod: Redis (already in scope for Phase 0E job queue, see below)
 *
 * Today we ship the in-process Map. When Phase 0E (BullMQ + Redis)
 * lands, this file is the seam: swap `store` to a Redis client and
 * nothing else changes.
 *
 * API:
 *   await reserve(productId, options, qty, ownerId)  -> { ok, expiresAt }
 *   await release(productId, options, qty, ownerId)  -> { ok }
 *   await confirm(productId, options, qty, ownerId)  -> { ok }
 *   await availableStock(product)                     -> int
 *
 * `ownerId` is `${userId || 'guest:' + guestId}`. Holds are scoped
 * per owner so a guest's hold doesn't clobber a logged-in user's.
 */

const TTL_MS = parseInt(process.env.STOCK_RESERVATION_TTL_MS, 10) || 10 * 60 * 1000;

// In-process store. Key shape:
//   `productId|optionKey1=v1&optionKey2=v2` -> [{ ownerId, qty, expiresAt }]
// Variant options are sorted by key for stable matching.
const store = new Map();

function variantKey(productId, options = {}) {
  const sorted = Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('&');
  return `${productId}|${sorted}`;
}

function purgeExpired(key) {
  const list = store.get(key);
  if (!list) return [];
  const now = Date.now();
  const fresh = list.filter((h) => h.expiresAt > now);
  if (fresh.length === 0) store.delete(key);
  else store.set(key, fresh);
  return fresh;
}

function heldQty(key, ownerId = null) {
  const list = purgeExpired(key);
  if (ownerId) {
    return list.filter((h) => h.ownerId === ownerId).reduce((s, h) => s + h.qty, 0);
  }
  return list.reduce((s, h) => s + h.qty, 0);
}

function variantStock(product, options = {}) {
  if (!product.variants || product.variants.length === 0) {
    return product.stock || 0;
  }
  const target = Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
  const match = product.variants.find((v) => {
    const k = Object.entries(v.options || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k2, v2]) => `${k2}=${v2}`)
      .join('|');
    return k === target;
  });
  return match ? match.stock : 0;
}

/**
 * Reserve `qty` units of `product` for `ownerId` until `expiresAt`.
 * Returns { ok, expiresAt, available, requested }.
 *   ok=false means not enough stock; the caller should 409.
 */
async function reserve(product, options, qty, ownerId) {
  const stock = variantStock(product, options);
  const key = variantKey(product._id.toString(), options);

  // Available = stock − sum of *other* owners' holds.
  const otherHolds = purgeExpired(key)
    .filter((h) => h.ownerId !== ownerId)
    .reduce((s, h) => s + h.qty, 0);
  const available = Math.max(0, stock - otherHolds);

  if (available < qty) {
    return { ok: false, available, requested: qty };
  }

  const list = store.get(key) || [];
  // Replace any existing hold for this owner.
  const filtered = list.filter((h) => h.ownerId !== ownerId);
  filtered.push({ ownerId, qty, expiresAt: Date.now() + TTL_MS });
  store.set(key, filtered);
  return { ok: true, expiresAt: filtered[filtered.length - 1].expiresAt, available, requested: qty };
}

/**
 * Release `qty` units of `product` for `ownerId`. Idempotent — calling
 * with qty > held just clears the owner's hold.
 */
async function release(product, options, qty, ownerId) {
  const key = variantKey(product._id.toString(), options);
  const list = purgeExpired(key).filter((h) => h.ownerId !== ownerId);
  store.set(key, list);
  return { ok: true };
}

/**
 * Confirm `qty` units of `product` for `ownerId` — convert the hold
 * into a permanent stock decrement. The hold is removed; the caller
 * is responsible for also decrementing `product.stock`/`variant.stock`
 * in the same transaction.
 */
async function confirm(product, options, qty, ownerId) {
  const key = variantKey(product._id.toString(), options);
  const list = purgeExpired(key).filter((h) => h.ownerId !== ownerId);
  store.set(key, list);
  return { ok: true };
}

/**
 * Compute the currently-available stock, factoring in active holds.
 * Use this in the cart's GET response and at checkout.
 */
async function availableStock(product, options = {}) {
  const stock = variantStock(product, options);
  const key = variantKey(product._id.toString(), options);
  const holds = purgeExpired(key).reduce((s, h) => s + h.qty, 0);
  return Math.max(0, stock - holds);
}

/**
 * Sweep all expired holds. Cheap; called lazily on each operation, but
 * also exposed so a cron can call it.
 */
function sweep() {
  let freed = 0;
  for (const k of store.keys()) {
    const before = store.get(k).length;
    const after = purgeExpired(k);
    freed += before - after.length;
  }
  return freed;
}

module.exports = {
  reserve,
  release,
  confirm,
  availableStock,
  sweep,
  TTL_MS,
  // exported for tests
  _store: store,
  _variantKey: variantKey,
  _variantStock: variantStock,
};