/**
 * Phase 4 — Order cancel + tracking.
 *
 *   POST /api/orders/:id/cancel  → 200 (buyer), 403 (other), 409
 *                                    (already shipped)
 *   POST /api/orders/:id/track   → 200 (own vendor), 403 (other)
 *
 * Verifies:
 *   - cancelling restores stock on the product
 *   - cancelledAt and a trackingHistory entry are written
 *   - shipped orders can't be cancelled
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
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("\nPhase 4 — Order cancel + tracking\n");

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

  const orderRoutes = require("../src/routes/orders");
  app.use("/api/orders", orderRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const User = require("../src/models/User");
    const Product = require("../src/models/Product");
    const Order = require("../src/models/Order");

    const buyer = await User.create({ name: "Buyer", email: "b@x.com", passwordHash: "x" });
    const otherBuyer = await User.create({ name: "Other", email: "o@x.com", passwordHash: "x" });
    const vendor = await User.create({ name: "Vendor", email: "v@x.com", passwordHash: "x", role: "vendor" });
    const otherVendor = await User.create({ name: "OtherVendor", email: "ov@x.com", passwordHash: "x", role: "vendor" });

    const product = await Product.create({
      name: "P", brand: "B", category: "C", basePrice: 10,
      vendor: vendor._id, isActive: true, stock: 100,
    });

    // Order in `pending` state
    const order = await Order.create({
      user: buyer._id,
      items: [{ product: product._id, quantity: 5, price: 10, vendor: vendor._id }],
      totalAmount: 50,
      status: "pending",
      shippingAddress: { name: "B", phone: "1", line1: "L", city: "C", state: "S", pincode: "00000", country: "IN" },
    });
    // Deduct the stock as the order would have
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: -5 } });

    // 1. Cancel as buyer
    const r1 = await fetch(`${base}/api/orders/${order._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(buyer._id)}` },
    });
    check("buyer cancel → 200", r1.status === 200);
    const after1 = await Product.findById(product._id);
    check("stock restored (100 - 5 + 5 = 100)", after1.stock === 100);
    const o1 = await Order.findById(order._id);
    check("status = cancelled", o1.status === "cancelled");
    check("cancelledAt set", o1.cancelledAt instanceof Date);
    check("tracking history has 1 entry", o1.trackingHistory.length === 1);
    check("tracking entry status = cancelled", o1.trackingHistory[0].status === "cancelled");

    // 2. Cancelling an already-cancelled order → 409
    const r2 = await fetch(`${base}/api/orders/${order._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(buyer._id)}` },
    });
    check("already cancelled → 409", r2.status === 409);

    // 3. Shipped order cannot be cancelled
    const shipped = await Order.create({
      user: buyer._id,
      items: [{ product: product._id, quantity: 1, price: 10, vendor: vendor._id }],
      totalAmount: 10,
      status: "shipped",
      shippingAddress: { name: "B", phone: "1", line1: "L", city: "C", state: "S", pincode: "00000", country: "IN" },
    });
    const r3 = await fetch(`${base}/api/orders/${shipped._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(buyer._id)}` },
    });
    check("shipped → 409", r3.status === 409);

    // 4. Other buyer cannot cancel
    const r4 = await fetch(`${base}/api/orders/${shipped._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(otherBuyer._id)}` },
    });
    check("other buyer cancel → 403", r4.status === 403);

    // 5. Vendor tracking: own vendor can update
    const newOrder = await Order.create({
      user: buyer._id,
      items: [{ product: product._id, quantity: 1, price: 10, vendor: vendor._id }],
      totalAmount: 10,
      status: "confirmed",
      shippingAddress: { name: "B", phone: "1", line1: "L", city: "C", state: "S", pincode: "00000", country: "IN" },
    });
    const r5 = await fetch(`${base}/api/orders/${newOrder._id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(vendor._id, "vendor")}` },
      body: JSON.stringify({ status: "shipped", note: "DHL tracking 1234" }),
    });
    check("vendor track → 200", r5.status === 200);
    const o5 = await Order.findById(newOrder._id);
    check("status = shipped", o5.status === "shipped");
    check("tracking has 1 entry", o5.trackingHistory.length === 1);
    check("tracking note = DHL", o5.trackingHistory[0].note === "DHL tracking 1234");

    // 6. Different vendor cannot update
    const r6 = await fetch(`${base}/api/orders/${newOrder._id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(otherVendor._id, "vendor")}` },
      body: JSON.stringify({ status: "delivered" }),
    });
    check("other vendor track → 403", r6.status === 403);

    // 7. Bad id → 400
    const r7 = await fetch(`${base}/api/orders/not-an-id/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token(buyer._id)}` },
    });
    check("bad id → 400", r7.status === 400);

    // 8. Delivered order: deliveredAt set
    await Order.findByIdAndUpdate(newOrder._id, { status: "delivered" });
    const o8 = await Order.findById(newOrder._id);
    check("deliveredAt set on save", o8.deliveredAt instanceof Date);

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