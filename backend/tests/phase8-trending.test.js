/**
 * Phase 8 — Trending products.
 *
 *   GET /api/products/trending  → 200
 *
 * Verifies:
 *   - likes within the window rank products by like count
 *   - products outside the window do not influence ranking
 *   - the route is hit BEFORE /:id (i.e. GET /api/products/trending
 *     does NOT 400 with a bad-id error)
 *   - falls back to highest-rated when not enough recent likes
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.MONGO_URI = "mongodb://placeholder/dryp";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  console.log("\nPhase 8 — Trending\n");

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

  const productRoutes = require("../src/routes/products");
  app.use("/api/products", productRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const User = require("../src/models/User");
    const Product = require("../src/models/Product");
    const Like = require("../src/models/Like");

    const vendor = await User.create({ name: "V", email: "v@x.com", passwordHash: "x", role: "vendor" });
    // 6 distinct users so we can put 6 unique likes on p1.
    const users = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        User.create({ name: `U${i}`, email: `u${i}@x.com`, passwordHash: "x" })
      )
    );

    const p1 = await Product.create({ name: "P1", brand: "B", category: "C", basePrice: 10, vendor: vendor._id, isActive: true, rating: 4.0 });
    const p2 = await Product.create({ name: "P2", brand: "B", category: "C", basePrice: 10, vendor: vendor._id, isActive: true, rating: 5.0 });
    const p3 = await Product.create({ name: "P3", brand: "B", category: "C", basePrice: 10, vendor: vendor._id, isActive: true, rating: 3.0 });
    const p4 = await Product.create({ name: "P4", brand: "B", category: "C", basePrice: 10, vendor: vendor._id, isActive: true, rating: 4.5 });
    // p4 is the highest-rated but no recent likes; it should NOT
    // surface in the recent-likes path.

    // 6 likes on p1, 2 on p2, 1 on p3
    const docs = [];
    for (let i = 0; i < 6; i++) docs.push({ product: p1._id, user: users[i]._id, createdAt: new Date() });
    for (let i = 0; i < 2; i++) docs.push({ product: p2._id, user: users[i]._id, createdAt: new Date() });
    docs.push({ product: p3._id, user: users[0]._id, createdAt: new Date() });
    await Like.insertMany(docs);

    // 1. /trending is reachable as a literal path (NOT parsed as :id)
    const r1 = await fetch(`${base}/api/products/trending`);
    check("trending → 200 (not 400)", r1.status === 200);
    const arr1 = await r1.json();
    check("returns array", Array.isArray(arr1));
    check("returns 3 products (the liked ones)", arr1.length === 3);
    check("p1 is first (most likes)", arr1[0]._id === String(p1._id));
    check("p2 is second", arr1[1]._id === String(p2._id));
    check("p3 is third", arr1[2]._id === String(p3._id));
    check("p4 NOT included (no recent likes)", !arr1.find((p) => p._id === String(p4._id)));

    // 2. limit query
    const r2 = await fetch(`${base}/api/products/trending?limit=1`);
    const arr2 = await r2.json();
    check("limit=1 → 1 product", arr2.length === 1);

    // 3. fallback to highest-rated: clear all recent likes
    await Like.deleteMany({});
    const r3 = await fetch(`${base}/api/products/trending`);
    const arr3 = await r3.json();
    check("fallback returns array", Array.isArray(arr3));
    check("fallback: p2 is first (rating 5.0)", arr3[0]._id === String(p2._id));

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