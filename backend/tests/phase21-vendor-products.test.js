/**
 * Phase 2.1 — vendor id-space fix
 *
 * Confirms the contract:
 *   - POST /api/products writes vendor = User._id (NOT Vendor._id).
 *   - GET /api/vendors/me/products returns products for that user.
 *
 * Without this, vendor portals would show empty when the data on disk
 * was originally created against a different id space.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://placeholder";

const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const Vendor = require("../src/models/Vendor");
const Product = require("../src/models/Product");
const productsRoute = require("../src/routes/products");
const vendorsRoute = require("../src/routes/vendors");
const { requireVendor } = require("../src/middleware/requireRole");
const { validateEnv } = require("../src/config/validateEnv");

const MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;

let mongo;
let server;
let baseUrl;
let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

async function bootstrap() {
  // Skip env validation in this test harness by setting required vars.
  process.env.MONGO_URI = await mongo.getUri("phase21");
  validateEnv();
  const User = require("../src/models/User");
  const Vendor = require("../src/models/Vendor");
  const Product = require("../src/models/Product");
  return { User, Vendor, Product };
}

(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("phase21"));

  // Two vendors: A and B, each with their own User and Vendor doc.
  const passwordHash = await bcrypt.hash("password123", 10);
  const userA = await User.create({
    name: "Vendor A",
    email: "a@dryp.test",
    passwordHash,
    role: "vendor",
  });
  const vendorA = await Vendor.create({
    owner: userA._id,
    name: "A's Studio",
    email: "a-studio@dryp.test",
  });
  const userB = await User.create({
    name: "Vendor B",
    email: "b@dryp.test",
    passwordHash,
    role: "vendor",
  });
  const vendorB = await Vendor.create({
    owner: userB._id,
    name: "B's Studio",
    email: "b-studio@dryp.test",
  });

  // Set up a small express app
  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRoute);
  app.use("/api/vendors", vendorsRoute);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Create two products for A and one for B
  const tokenA = jwt.sign(
    { id: userA._id.toString(), role: "vendor" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const tokenB = jwt.sign(
    { id: userB._id.toString(), role: "vendor" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  async function postProduct(token, body) {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res;
  }
  async function getMyProducts(token) {
    const res = await fetch(`${baseUrl}/api/vendors/me/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res;
  }

  // 1. POST /api/products writes vendor = User._id
  const r1 = await postProduct(tokenA, {
    name: "A-1",
    brand: "DRYP",
    category: "tops",
    basePrice: 50,
  });
  check("vendor A's first product POST returns 201", r1.status === 201);
  const product1 = await r1.json();
  check(
    "product's vendor is the User._id, not the Vendor._id",
    product1.vendor === userA._id.toString() &&
      product1.vendor !== vendorA._id.toString(),
  );

  const r2 = await postProduct(tokenA, {
    name: "A-2",
    brand: "DRYP",
    category: "tops",
    basePrice: 60,
  });
  check("vendor A's second product POST returns 201", r2.status === 201);

  const r3 = await postProduct(tokenB, {
    name: "B-1",
    brand: "DRYP",
    category: "tops",
    basePrice: 70,
  });
  check("vendor B's product POST returns 201", r3.status === 201);

  // 2. GET /api/vendors/me/products returns A's products only
  const r4 = await getMyProducts(tokenA);
  check("GET /me/products returns 200 for vendor A", r4.status === 200);
  const aProducts = await r4.json();
  check(
    "vendor A sees exactly 2 products",
    Array.isArray(aProducts) && aProducts.length === 2,
  );
  check(
    "vendor A's products all have vendor = userA._id",
    aProducts.every((p) => p.vendor === userA._id.toString()),
  );
  check(
    "vendor A does NOT see vendor B's product",
    !aProducts.some((p) => p.name === "B-1"),
  );

  const r5 = await getMyProducts(tokenB);
  check("GET /me/products returns 200 for vendor B", r5.status === 200);
  const bProducts = await r5.json();
  check(
    "vendor B sees exactly 1 product",
    Array.isArray(bProducts) && bProducts.length === 1,
  );
  check(
    "vendor B sees their own product",
    bProducts[0]?.name === "B-1",
  );

  // 3. Cross-vendor: vendor A trying to update vendor B's product → 403
  const bProduct = bProducts[0];
  const crossRes = await fetch(`${baseUrl}/api/products/${bProduct._id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "stolen" }),
  });
  check(
    "cross-vendor PUT returns 403, not 401 or 200",
    crossRes.status === 403,
  );

  // teardown
  server.close();
  await mongoose.disconnect();
  await mongo.stop();

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});