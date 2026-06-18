/**
 * Phase 5.4 — zod schemas for products, vendors, users, orders, cart.
 *
 * The schemas themselves are the contract; the actual integration into
 * routes is a per-route change tracked elsewhere. This test verifies
 * that each schema:
 *   1. loads without error
 *   2. accepts a valid body
 *   3. rejects a clearly invalid body (e.g. wrong type, too short, bad id)
 *
 * Why we test schemas in isolation:
 *   - Schemas are pure data. A schema test runs in <50ms with no
 *     Mongo/Express.
 *   - A breaking change to a schema is caught here before it can
 *     crash a request handler at runtime.
 */

const schemas = ['auth', 'products', 'vendors', 'users', 'orders', 'cart'];
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

function expectOk(name, schema, value) {
  const r = schema.safeParse(value);
  check(`${name} accepts valid input`, r.success === true);
  if (!r.success) console.log('    issues:', JSON.stringify(r.error.issues));
}
function expectFail(name, schema, value, pathFragment) {
  const r = schema.safeParse(value);
  check(`${name} rejects invalid input`, r.success === false);
  if (r.success) return;
  if (pathFragment) {
    const hit = r.error.issues.some(i => i.path.join('.').includes(pathFragment));
    check(`${name} error mentions ${pathFragment}`, hit);
  }
}

const requiredEnv = ['JWT_SECRET'];
for (const k of requiredEnv) {
  if (!process.env[k]) process.env[k] = 'test-jwt-secret-must-be-at-least-32-chars-long';
}
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://placeholder';

(async () => {
  // 1. all load
  const loaded = {};
  for (const s of schemas) {
    try {
      loaded[s] = require('../src/schemas/' + s);
      check(`schema ${s} loads`, true);
    } catch (e) {
      check(`schema ${s} loads`, false);
      console.log('    error:', e.message);
    }
  }

  // 2. auth
  expectOk('auth.register', loaded.auth.register, {
    name: 'A', email: 'a@b.com', password: 'Password1'
  });
  expectFail('auth.register (bad email)', loaded.auth.register, {
    name: 'A', email: 'no-at-sign', password: 'Password1'
  }, 'email');
  expectFail('auth.register (short password)', loaded.auth.register, {
    name: 'A', email: 'a@b.com', password: 'short'
  }, 'password');

  // 3. products
  expectOk('products.create', loaded.products.create, {
    name: 'Tee', brand: 'Zara', category: 'tops', basePrice: 19.99,
    tags: ['casual'], options: [], variants: [], images: ['https://x.com/a.jpg']
  });
  expectFail('products.create (bad id in listQuery)', loaded.products.idParam, { id: 'not-an-id' }, 'id');
  expectOk('products.idParam (valid)', loaded.products.idParam, {
    id: '507f1f77bcf86cd799439011'
  });
  expectOk('products.listQuery', loaded.products.listQuery, {
    minPrice: '10', maxPrice: '50', page: '2'
  });
  expectOk('products.update (empty)', loaded.products.update, {});

  // 4. vendors
  expectOk('vendors.register', loaded.vendors.register, {
    name: 'Studio', email: 's@s.com', password: 'Password1'
  });
  expectFail('vendors.register (missing name)', loaded.vendors.register, {
    email: 's@s.com', password: 'Password1'
  }, 'name');
  expectOk('vendors.login', loaded.vendors.login, {
    email: 's@s.com', password: 'anything'
  });
  expectFail('vendors.login (no email)', loaded.vendors.login, { password: 'x' }, 'email');

  // 5. users
  expectOk('users.updateMe (empty)', loaded.users.updateMe, {});
  expectOk('users.addAddress', loaded.users.addAddress, {
    label: 'home', street: '1 Main', city: 'NYC', state: 'NY', zipCode: '10001', country: 'US'
  });
  expectFail('users.addAddress (no street)', loaded.users.addAddress, {
    city: 'NYC', state: 'NY', zipCode: '10001', country: 'US'
  }, 'street');
  expectOk('users.changePassword', loaded.users.changePassword, {
    currentPassword: 'old', newPassword: 'Newpass1'
  });
  expectFail('users.changePassword (weak new)', loaded.users.changePassword, {
    currentPassword: 'old', newPassword: 'weak'
  }, 'newPassword');
  expectOk('users.setRole', loaded.users.setRole, { role: 'vendor' });
  expectFail('users.setRole (bad role)', loaded.users.setRole, { role: 'overlord' }, 'role');

  // 6. orders
  expectOk('orders.create', loaded.orders.create, {
    shippingAddress: { street: '1', city: 'X', state: 'X', zipCode: '1', country: 'X' }
  });
  expectFail('orders.create (no address)', loaded.orders.create, {}, 'shippingAddress');
  expectOk('orders.updateStatus', loaded.orders.updateStatus, { status: 'shipped' });
  expectFail('orders.updateStatus (bad status)', loaded.orders.updateStatus, { status: 'banana' }, 'status');

  // 7. cart
  expectOk('cart.addItem', loaded.cart.addItem, {
    productId: '507f1f77bcf86cd799439011', quantity: 2
  });
  expectFail('cart.addItem (bad productId)', loaded.cart.addItem, {
    productId: 'no', quantity: 2
  }, 'productId');
  expectFail('cart.addItem (zero quantity)', loaded.cart.addItem, {
    productId: '507f1f77bcf86cd799439011', quantity: 0
  }, 'quantity');
  expectOk('cart.updateItem (set to 0 = remove)', loaded.cart.updateItem, { quantity: 0 });

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})();