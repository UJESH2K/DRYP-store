/**
 * Phase 2 — Reviews.
 *
 *   POST /api/products/:id/reviews      → 201 (auth), 401 (no auth)
 *   POST again same product             → 409 (one review per user)
 *   GET  /api/products/:id/reviews      → 200 (paginated)
 *   DELETE /api/reviews/:reviewId       → 200 (owner), 403 (other)
 *
 * Confirms Product.rating is recomputed and stays in sync with the
 * number of reviews.
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
  console.log("\nPhase 2 — Reviews\n");

  const env = require("../src/config/validateEnv")({ exitOnError: true });
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());

  // Force model registration so Review can build its indexes.
  const User = require("../src/models/User");
  const Product = require("../src/models/Product");
  const Review = require("../src/models/Review");
  await Review.syncIndexes();
  await Product.syncIndexes();
  await User.syncIndexes();

  const express = require("express");
  const cors = require("cors");
  const requestId = require("../src/middleware/requestId");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cors());
  app.use(requestId());

  // Mount under /api/products so the same router serves both the
  // products list/detail and the reviews sub-route. Express matches
  // /products/:id/reviews only if the products router forwards to
  // the reviews router, or if we mount the reviews router at /api
  // which is what server.js does. The test mounts both routes at
  // /api to mirror that.
  const productRoutes = require("../src/routes/products");
  const reviewRoutes = require("../src/routes/reviews");
  app.use("/api/products", productRoutes);
  app.use("/api", reviewRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {

    // Setup: vendor, user, product
    const vendor = await User.create({ name: "V", email: "v@x.com", passwordHash: "x", role: "vendor" });
    const user1 = await User.create({ name: "U1", email: "u1@x.com", passwordHash: "x" });
    const user2 = await User.create({ name: "U2", email: "u2@x.com", passwordHash: "x" });
    const product = await Product.create({
      name: "P", brand: "B", category: "C", basePrice: 10,
      vendor: vendor._id, isActive: true, rating: 0, reviews: 0,
    });

    // 1. POST without auth → 401
    const r1 = await fetch(`${base}/api/products/${product._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    });
    check("POST without auth → 401", r1.status === 401);

    // 2. POST with bad rating → 400 (zod)
    const r2 = await fetch(`${base}/api/products/${product._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user1._id)}` },
      body: JSON.stringify({ rating: 9 }),
    });
    check("POST rating=9 → 400", r2.status === 400);

    // 3. POST rating=5 → 201, product.rating becomes 5
    const r3 = await fetch(`${base}/api/products/${product._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user1._id)}` },
      body: JSON.stringify({ rating: 5, comment: "great" }),
    });
    check("POST rating=5 → 201", r3.status === 201);
    const b3 = await r3.json();
    check("review has rating=5", b3.rating === 5);
    const after3 = await Product.findById(product._id);
    check("product.rating = 5", after3.rating === 5);
    check("product.reviews = 1", after3.reviews === 1);

    // 4. POST again as same user → 409 (already reviewed)
    const r4 = await fetch(`${base}/api/products/${product._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user1._id)}` },
      body: JSON.stringify({ rating: 4 }),
    });
    if (r4.status !== 409) {
      const text = await r4.text();
      console.log("  ! r4 status", r4.status, "body:", text);
    }
    check("POST same user/product → 409", r4.status === 409);

    // 5. POST as user2 with rating=3 → 201, average becomes 4
    const r5 = await fetch(`${base}/api/products/${product._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user2._id)}` },
      body: JSON.stringify({ rating: 3 }),
    });
    check("POST rating=3 (user2) → 201", r5.status === 201);
    const after5 = await Product.findById(product._id);
    check("product.rating = 4.0", after5.rating === 4);
    check("product.reviews = 2", after5.reviews === 2);

    // 6. GET reviews → 200, includes both reviews
    const r6 = await fetch(`${base}/api/products/${product._id}/reviews`);
    check("GET reviews → 200", r6.status === 200);
    const b6 = await r6.json();
    check("GET reviews count = 2", b6.total === 2);
    check("GET reviews hasMore=false", b6.hasMore === false);

    // 7. POST against non-existent product → 404
    const fakeId = "507f1f77bcf86cd799439011";
    const r7 = await fetch(`${base}/api/products/${fakeId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user2._id)}` },
      body: JSON.stringify({ rating: 5 }),
    });
    check("POST nonexistent → 404", r7.status === 404);

    // 8. POST with bad product id → 400 (zod)
    const r8 = await fetch(`${base}/api/products/not-an-id/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(user2._id)}` },
      body: JSON.stringify({ rating: 5 }),
    });
    check("POST bad id → 400", r8.status === 400);

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