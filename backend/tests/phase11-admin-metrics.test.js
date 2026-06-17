/**
 * Phase 11 — Admin metrics endpoint.
 *
 *   GET /api/analytics/admin/metrics → 200
 *
 * Verifies:
 *   - admin role required (401 for unauth, 403 for vendor, 200 for admin)
 *   - counts reflect the DB
 *   - revenueByDay is 30 entries (back-filled with zeros)
 *   - topVendors reflects unwind + group + sort
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.MONGO_URI = "mongodb://placeholder/dryp";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function token(userId, role = "user") {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("\nPhase 11 — Admin metrics\n");

  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());

  const express = require("express");
  const cors = require("cors");
  const requestId = require("../src/middleware/requestId");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cors());
  app.use(requestId());

  const analyticsRoutes = require("../src/routes/analytics");
  app.use("/api/analytics", analyticsRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const User = require("../src/models/User");
    const Vendor = require("../src/models/Vendor");
    const Product = require("../src/models/Product");
    const Order = require("../src/models/Order");

    const admin = await User.create({ name: "Admin", email: "a@x.com", passwordHash: "x", role: "admin" });
    const customer = await User.create({ name: "Cust", email: "c@x.com", passwordHash: "x" });
    const vendor = await User.create({ name: "V", email: "v@x.com", passwordHash: "x", role: "vendor" });
    const vendorDoc = await Vendor.create({ name: "Acme", email: "v@x.com", owner: vendor._id });
    const product = await Product.create({
      name: "P", brand: "B", category: "C", basePrice: 50, vendor: vendor._id, isActive: true,
    });
    const addr = { name: "X", phone: "1", line1: "x", city: "x", state: "x", pincode: "x", country: "US" };
    await Order.create({
      user: customer._id, totalAmount: 150, shippingAddress: addr,
      items: [{ product: product._id, quantity: 3, price: 50, vendor: vendor._id }],
    });
    await Order.create({
      user: customer._id, totalAmount: 75, status: 'cancelled', shippingAddress: addr,
      items: [{ product: product._id, quantity: 1, price: 75, vendor: vendor._id }],
    });

    // 1. No auth → 401
    const r1 = await fetch(`${base}/api/analytics/admin/metrics`);
    check("no auth → 401", r1.status === 401);

    // 2. Vendor → 403
    const r2 = await fetch(`${base}/api/analytics/admin/metrics`, {
      headers: { Authorization: `Bearer ${token(vendor._id, 'vendor')}` },
    });
    check("vendor → 403", r2.status === 403);

    // 3. Customer → 403
    const r3 = await fetch(`${base}/api/analytics/admin/metrics`, {
      headers: { Authorization: `Bearer ${token(customer._id, 'user')}` },
    });
    check("user → 403", r3.status === 403);

    // 4. Admin → 200
    const r4 = await fetch(`${base}/api/analytics/admin/metrics`, {
      headers: { Authorization: `Bearer ${token(admin._id, 'admin')}` },
    });
    check("admin → 200", r4.status === 200);
    const body = await r4.json();

    check("counts.users ≥ 3", body.counts.users >= 3);
    check("counts.vendors ≥ 1", body.counts.vendors >= 1);
    check("counts.products ≥ 1", body.counts.products >= 1);
    check("counts.orders = 2", body.counts.orders === 2);
    // Cancelled order's $75 is excluded from revenue.
    check("counts.revenue = 150", body.counts.revenue === 150);

    check("revenueByDay has 30 entries", body.revenueByDay.length === 30);
    check("signupsByDay is array", Array.isArray(body.signupsByDay));
    check("ordersByStatus is object", typeof body.ordersByStatus === 'object');
    check("ordersByStatus.cancelled = 1", body.ordersByStatus.cancelled === 1);

    check("topVendors length = 1", body.topVendors.length === 1);
    check("topVendors[0].vendorName = Acme", body.topVendors[0].vendorName === "Acme");
    // Cancelled order is excluded; only the $150 order contributes.
    check("topVendors[0].revenue = 150", body.topVendors[0].revenue === 150);

  } finally {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  }

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});