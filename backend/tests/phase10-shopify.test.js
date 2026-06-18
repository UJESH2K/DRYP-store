/**
 * Phase 10 — Shopify integration.
 *
 *   GET    /api/vendors/shopify     → status (no token in response)
 *   PUT    /api/vendors/shopify     → 200 (encrypted token at rest)
 *   POST   /api/vendors/shopify/test → 200 (stubbed Shopify)
 *   DELETE /api/vendors/shopify     → 200 (wipes token)
 *
 * The token-encryption roundtrip is also exercised.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.MONGO_URI = "mongodb://placeholder/dryp";
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "this-is-a-test-key-exactly-32-by"; // 32 bytes
// (key length: 31 chars; the crypto helper sha256-derives 32 bytes from it.)

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function token(userId, role = "vendor") {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("\nPhase 10 — Shopify integration\n");

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

  // Stub fetch BEFORE the routes load so the test endpoint can
  // pretend Shopify returned a count.
  const origFetch = global.fetch;
  global.fetch = (url, opts) => {
    if (String(url).includes("/admin/api/")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({ count: 42 }),
      });
    }
    return origFetch(url, opts);
  };

  const vendorRoutes = require("../src/routes/vendors");
  app.use("/api/vendors", vendorRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // Encryption roundtrip
    const { encrypt, decrypt } = require("../src/utils/shopifyCrypto");
    const sample = "shpat_aaaaa-bbbbb-ccccc";
    const ct = encrypt(sample);
    check("encrypt produces ciphertext", ct !== sample);
    check("decrypt recovers plaintext", decrypt(ct) === sample);
    // Different invocations produce different ciphertexts (random IV)
    const ct2 = encrypt(sample);
    check("encrypt uses random IV", ct !== ct2);

    // Set up vendor + user
    const User = require("../src/models/User");
    const Vendor = require("../src/models/Vendor");
    const user = await User.create({
      name: "V", email: "v@x.com", passwordHash: "x", role: "vendor",
    });
    const vendor = await Vendor.create({
      name: "Acme", email: "v@x.com", owner: user._id,
    });
    const tok = token(user._id);

    // 1. GET before connection → enabled: false
    const r1 = await fetch(`${base}/api/vendors/shopify`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    check("GET no connection → 200", r1.status === 200);
    const b1 = await r1.json();
    check("enabled = false", b1.enabled === false);

    // 2. PUT bad shop → 400
    const r2 = await fetch(`${base}/api/vendors/shopify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ shop: "not-a-shop.myshopify.com/evil", accessToken: "x" }),
    });
    check("bad shop → 400", r2.status === 400);

    // 3. PUT valid → 200
    const r3 = await fetch(`${base}/api/vendors/shopify`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ shop: "acme.myshopify.com", accessToken: "shpat_secret" }),
    });
    check("valid connect → 200", r3.status === 200);
    const b3 = await r3.json();
    check("status = connected", b3.status === "connected");
    check("shop = acme.myshopify.com", b3.shop === "acme.myshopify.com");
    check("accessToken NOT in response", b3.accessToken === undefined);

    // 4. Token is encrypted at rest
    const fresh = await Vendor.findById(vendor._id);
    check("token encrypted at rest", fresh.shopify.accessToken !== "shpat_secret");
    check("token decrypts to original", decrypt(fresh.shopify.accessToken) === "shpat_secret");

    // 5. POST test → ok, count=42
    const r5 = await fetch(`${base}/api/vendors/shopify/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}` },
    });
    check("test → 200", r5.status === 200);
    const b5 = await r5.json();
    check("test ok = true", b5.ok === true);
    check("productsCount = 42", b5.productsCount === 42);

    // 6. DELETE → wipes
    const r6 = await fetch(`${base}/api/vendors/shopify`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tok}` },
    });
    check("delete → 200", r6.status === 200);
    const after = await Vendor.findById(vendor._id);
    check("shopify wiped", !after.shopify?.shop);

    // 7. No auth → 401
    const r7 = await fetch(`${base}/api/vendors/shopify`);
    check("no auth → 401", r7.status === 401);

  } finally {
    global.fetch = origFetch;
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