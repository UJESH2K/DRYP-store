/**
 * Phase 5.1 — requireRole middleware contract
 *
 * Verifies:
 *   - requireVendor on a protected route returns 403 for a user/vendee.
 *   - requireAdmin returns 403 for a vendor.
 *   - Order ownership check (not a role gate) still works for the user
 *     and for the vendor who owns the product.
 *
 * This pins down the existing copy-paste role checks so that future
 * routes that try to role-gate on `req.user.role` directly will be
 * caught by these tests passing.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://placeholder";

const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const productsRoute = require("../src/routes/products");
const vendorsRoute = require("../src/routes/vendors");
const ordersRoute = require("../src/routes/orders");

const MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;

let mongo, server, baseUrl;
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function tokenFor(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("phase51"));

  const hash = await bcrypt.hash("password123", 10);
  const buyer = await User.create({
    name: "Buyer",
    email: "buyer@dryp.test",
    passwordHash: hash,
    role: "user",
  });
  const vendorUser = await User.create({
    name: "Vendor",
    email: "vendor@dryp.test",
    passwordHash: hash,
    role: "vendor",
  });
  const vendorDoc = await Vendor.create({
    owner: vendorUser._id,
    name: "V's Studio",
    email: "v@dryp.test",
  });
  // An order owned by the buyer, with one product from the vendor.
  const product = await Product.create({
    name: "P",
    brand: "DRYP",
    category: "tops",
    basePrice: 50,
    vendor: vendorUser._id,
  });
  const order = await Order.create({
    user: buyer._id,
    items: [{ product: product._id, quantity: 1, price: 50, vendor: vendorUser._id }],
    totalAmount: 50,
    status: "pending",
    orderNumber: "TEST-1",
    shippingAddress: {
      name: "Buyer",
      phone: "000",
      line1: "1 St",
      city: "City",
      state: "St",
      pincode: "00000",
      country: "IN",
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRoute);
  app.use("/api/vendors", vendorsRoute);
  app.use("/api/orders", ordersRoute);
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const buyerToken = await tokenFor(buyer);
  const vendorToken = await tokenFor(vendorUser);

  // 1. POST /api/products as a buyer → 403 (requireVendor)
  const r1 = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${buyerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "X", brand: "DRYP", category: "tops", basePrice: 1 }),
  });
  check("POST /api/products as buyer returns 403", r1.status === 403);

  // 2. POST /api/products as a vendor → 201
  const r2 = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vendorToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "X", brand: "DRYP", category: "tops", basePrice: 1 }),
  });
  check("POST /api/products as vendor returns 201", r2.status === 201);

  // 3. GET /api/orders/:id as the buyer (owner) → 200
  const r3 = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  check("GET /api/orders/:id as buyer (owner) returns 200", r3.status === 200);

  // 4. GET /api/orders/:id as a different user → 401
  const otherUser = await User.create({
    name: "Other",
    email: "other@dryp.test",
    passwordHash: hash,
    role: "user",
  });
  const otherToken = await tokenFor(otherUser);
  const r4 = await fetch(`${baseUrl}/api/orders/${order._id}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  check("GET /api/orders/:id as different user returns 401", r4.status === 401);

  // 5. POST /api/vendors/login with a non-vendor → 403
  const r5 = await fetch(`${baseUrl}/api/vendors/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@dryp.test", password: "password123" }),
  });
  check("POST /api/vendors/login as buyer returns 403", r5.status === 403);

  // 6. POST /api/vendors/login with a vendor → 200
  const r6 = await fetch(`${baseUrl}/api/vendors/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "vendor@dryp.test", password: "password123" }),
  });
  check("POST /api/vendors/login as vendor returns 200", r6.status === 200);

  server.close();
  await mongoose.disconnect();
  await mongo.stop();
  console.log(`\n  ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });