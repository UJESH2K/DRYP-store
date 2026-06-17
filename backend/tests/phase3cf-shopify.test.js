/**
 * Phase 3C/3D/3E/3F — Shopify connection + circuit breaker tests.
 *
 * We don't hit the real Shopify API. We stub global.fetch and verify:
 *  - pushStock: maps variant options to inventory_item_id and POSTs
 *    the right GraphQL mutation
 *  - pushStock: returns ok on 2xx response
 *  - pushStock: records a failure when the API errors
 *  - Circuit breaker: opens after 3 consecutive failures
 *  - Circuit breaker: short-circuits while open
 *  - fetchInventory: returns null when circuit is open (Phase 3F)
 *  - fetchInventory: parses the response
 *  - ShopifyConnection model: hides accessToken in toJSON
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.MONGO_URI = 'mongodb://placeholder';

const ShopifyConnection = require('../src/models/ShopifyConnection');
const shopify = require('../src/utils/shopifyClient');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function makeConn() {
  const sync = { lastSyncAt: null, lastError: null, consecutiveFailures: 0, circuitOpenUntil: null };
  return {
    shop: 'test-shop.myshopify.com',
    accessToken: 'shpat_xxx',
    productMap: new Map([['{"Color":"Red","Size":"M"}', 'gid://shopify/InventoryItem/12345']]),
    enabled: true,
    sync,
  };
}

(async () => {
  // 1. pushStock success
  {
    const conn = makeConn();
    const calls = [];
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        text: async () => '',
        json: async () => ({ data: { inventoryAdjustQuantities: { userErrors: [] } } }),
      };
    };
    const r = await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 5);
    check('push: ok', r.ok === true);
    check('push: 1 fetch call', calls.length === 1);
    check('push: hit shop domain', calls[0].url.includes('test-shop.myshopify.com'));
    const body = JSON.parse(calls[0].opts.body);
    check('push: mutation has correct input', body.variables.input.changes[0].delta === 5);
    check('push: token sent', calls[0].opts.headers['X-Shopify-Access-Token'] === 'shpat_xxx');
    check('push: success resets breaker', conn.sync.consecutiveFailures === 0);
    check('push: lastSyncAt set', conn.sync.lastSyncAt instanceof Date);
  }

  // 2. pushStock failure → breaker increments
  {
    const conn = makeConn();
    globalThis.fetch = async () => ({
      ok: false,
      text: async () => 'internal error',
    });
    const r = await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 1);
    check('push err: !ok', r.ok === false);
    check('push err: failure=1', conn.sync.consecutiveFailures === 1);
    check('push err: lastError set', conn.sync.lastError.includes('500') || conn.sync.lastError.includes('shopify'));
    check('push err: breaker not yet open', !conn.sync.circuitOpenUntil);
  }

  // 3. Circuit breaker: open after 3
  {
    const conn = makeConn();
    globalThis.fetch = async () => ({ ok: false, text: async () => 'fail' });
    await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 1);
    await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 1);
    await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 1);
    check('breaker: open after 3 fails', conn.sync.circuitOpenUntil instanceof Date);
    check('breaker: 4th call short-circuits', shopify.isCircuitOpen(conn.sync) === true);
    const r = await shopify.pushStock(conn, 'p1', { Color: 'Red', Size: 'M' }, 1);
    check('breaker: short-circuit returns breakerOpen', r.breakerOpen === true);
  }

  // 4. fetchInventory: null when circuit open (Phase 3F)
  {
    const conn = makeConn();
    conn.sync.consecutiveFailures = 3;
    conn.sync.circuitOpenUntil = new Date(Date.now() + 60_000);
    const v = await shopify.fetchInventory(conn, { Color: 'Red', Size: 'M' });
    check('fetchInventory: null when breaker open', v === null);
  }

  // 5. fetchInventory: parses response
  {
    const conn = makeConn();
    let lastUrl = null;
    globalThis.fetch = async (url) => {
      lastUrl = url;
      return {
        ok: true,
        text: async () => '',
        json: async () => ({ data: { inventoryItem: { tracked: true, inventoryLevel: { available: 7 } } } }),
      };
    };
    const v = await shopify.fetchInventory(conn, { Color: 'Red', Size: 'M' });
    check('fetchInventory: returns 7', v === 7);
    check('fetchInventory: hit the right URL', lastUrl.includes('test-shop.myshopify.com'));
  }

  // 6. fetchInventory: returns null on missing mapping
  {
    const conn = makeConn();
    conn.productMap = new Map();
    const v = await shopify.fetchInventory(conn, { Color: 'Green' });
    check('fetchInventory: null on missing mapping', v === null);
  }

  // 7. fetchInventory: returns null on Shopify error (don't break checkout)
  {
    const conn = makeConn();
    globalThis.fetch = async () => ({ ok: false, text: async () => 'down' });
    const v = await shopify.fetchInventory(conn, { Color: 'Red', Size: 'M' });
    check('fetchInventory: null on API error', v === null);
  }

  // 8. ShopifyConnection schema: hides accessToken in toJSON
  {
    const doc = new ShopifyConnection({
      vendor: '507f1f77bcf86cd799439011',
      shop: 'a.myshopify.com',
      accessToken: 'shpat_SECRET',
    });
    const json = doc.toJSON();
    check('schema: accessToken stripped', json.accessToken === undefined);
    check('schema: shop present', json.shop === 'a.myshopify.com');
  }

  // restore
  delete globalThis.fetch;

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();