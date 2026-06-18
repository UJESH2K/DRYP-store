/**
 * Phase 3B — stockCheck pre-checkout validator tests.
 *
 * Stubs ShopifyConnection and shopify.fetchInventory (no Mongo,
 * no real Shopify). Verifies:
 *  - happy path: db stock > requested → ok
 *  - insufficient stock: 409-able, includes the line in issues
 *  - reservations reduce available count
 *  - Shopify live check, when available, picks the lower of db & live
 *  - Shopify error → fall back to db
 *  - product missing → issue with reason=product_unavailable
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.MONGO_URI = 'mongodb://placeholder';

const reservation = require('../src/utils/stockReservation');
const shopify = require('../src/utils/shopifyClient');

// Stub the ShopifyConnection model used inside stockCheck.
const stubConns = new Map(); // vendorId -> { enabled, inventory }
const stubPath = require.resolve('../src/models/ShopifyConnection');
require.cache[stubPath] = {
  id: stubPath,
  filename: stubPath,
  loaded: true,
  exports: {
    findOne: () => ({
      lean: async () => {
        // The test only ever sets one connection (for vendor v1) and
        // we ignore the query filter — the model isn't real, so just
        // return whatever the test set.
        const v = 'v1';
        const conn = stubConns.get(v);
        return conn ? { ...conn, vendor: v } : null;
      },
    }),
  },
};

const stockCheck = require('../src/utils/stockCheck');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function makeProduct({ id = 'p1', vendor = 'v1', stock = 10, variants = [] } = {}) {
  return {
    _id: id,
    vendor: { toString: () => vendor },
    stock,
    variants,
  };
}

(async () => {
  // 1. happy path
  {
    reservation.sweep();
    const products = [makeProduct({ stock: 10 })];
    const items = [{ productId: 'p1', options: {}, quantity: 2 }];
    const r = await stockCheck.validate(items, products);
    check('happy: ok', r.ok === true);
    check('happy: no issues', r.issues.length === 0);
  }

  // 2. insufficient stock
  {
    reservation.sweep();
    const products = [makeProduct({ stock: 1 })];
    const items = [{ productId: 'p1', options: {}, quantity: 3 }];
    const r = await stockCheck.validate(items, products);
    check('insufficient: !ok', r.ok === false);
    check('insufficient: 1 issue', r.issues.length === 1);
    check('insufficient: requested=3', r.issues[0].requested === 3);
    check('insufficient: available=1', r.issues[0].available === 1);
    check('insufficient: source=db', r.issues[0].source === 'db');
  }

  // 3. reservations reduce available
  {
    reservation.sweep();
    const product = makeProduct({ id: 'p1', stock: 5 });
    // Simulate 3 held by a different owner
    await reservation.reserve(product, {}, 3, 'other-cart');
    const items = [{ productId: 'p1', options: {}, quantity: 3 }]; // 3 requested, 5 - 3 = 2 avail
    const r = await stockCheck.validate(items, [product]);
    check('holds: !ok', r.ok === false);
    check('holds: available=2', r.issues[0].available === 2);
    reservation.sweep();
  }

  // 4. Shopify live check (lower of db & live)
  {
    reservation.sweep();
    const products = [makeProduct({ stock: 10 })];
    stubConns.set('v1', { enabled: true });
    // Override fetchInventory
    const orig = shopify.fetchInventory;
    shopify.fetchInventory = async () => 4;
    const items = [{ productId: 'p1', options: {}, quantity: 5 }];
    const r = await stockCheck.validate(items, products);
    check('shopify: lower wins', r.issues[0].available === 4);
    check('shopify: source=shopify', r.issues[0].source === 'shopify');
    shopify.fetchInventory = orig;
  }

  // 5. Shopify error → fall back to db
  {
    reservation.sweep();
    const products = [makeProduct({ stock: 10 })];
    stubConns.set('v1', { enabled: true });
    const orig = shopify.fetchInventory;
    shopify.fetchInventory = async () => null; // circuit open / no mapping
    const items = [{ productId: 'p1', options: {}, quantity: 5 }];
    const r = await stockCheck.validate(items, products);
    check('shopify-fail: ok (db 10 >= 5)', r.ok === true);
    check('shopify-fail: source=db', r.issues.length === 0);
    shopify.fetchInventory = orig;
  }

  // 6. product missing
  {
    const products = [makeProduct({ id: 'p1', stock: 10 })];
    const items = [{ productId: 'p2', options: {}, quantity: 1 }];
    const r = await stockCheck.validate(items, products);
    check('missing: !ok', r.ok === false);
    check('missing: reason=product_unavailable', r.issues[0].reason === 'product_unavailable');
  }

  // 7. variant stock check (option key matches variant key exactly)
  {
    reservation.sweep();
    const products = [makeProduct({
      id: 'p1', stock: 0,
      variants: [
        { options: { Size: 'M' }, stock: 5, price: 1 },
        { options: { Size: 'L' }, stock: 1, price: 1 },
      ],
    })];
    const items = [
      { productId: 'p1', options: { Size: 'M' }, quantity: 5 },
      { productId: 'p1', options: { Size: 'L' }, quantity: 5 },
    ];
    const r = await stockCheck.validate(items, products);
    check('variants: only L fails', r.issues.length === 1 && r.issues[0].options.Size === 'L');
  }

  stubConns.clear();

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();