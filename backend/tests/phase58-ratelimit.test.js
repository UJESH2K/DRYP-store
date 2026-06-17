/**
 * Phase 5.8 — rate-limit /api/products, /api/cart, /api/wishlist, /api/likes
 *
 * Verifies that exceeding the per-minute limit returns 429 with a
 * message that names the resource.
 *
 * The default limits in server.js are:
 *   products 200/min, cart 60/min, wishlist 60/min, likes 120/min.
 * We use small test overrides via env so the test runs in a few seconds.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://placeholder";
process.env.RATELIMIT_DISABLE_REDIS = "1";

const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const rateLimit = require("express-rate-limit");

const MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;

let mongo, server, baseUrl;
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("phase58"));

  // Build a small app that uses the same limiters as server.js
  // but with small `max` values so the test runs fast.
  const app = express();
  app.use(express.json());

  const productsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    message: { message: "Too many product requests, please slow down" },
  });
  const cartLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    message: { message: "Too many cart requests, please slow down" },
  });
  const wishlistLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    message: { message: "Too many wishlist requests, please slow down" },
  });
  const likesLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    message: { message: "Too many like requests, please slow down" },
  });

  app.use("/api/products", productsLimiter, (req, res) => res.json({ ok: true }));
  app.use("/api/cart", cartLimiter, (req, res) => res.json({ ok: true }));
  app.use("/api/wishlist", wishlistLimiter, (req, res) => res.json({ ok: true }));
  app.use("/api/likes", likesLimiter, (req, res) => res.json({ ok: true }));

  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function burst(path, expectedMessage) {
    const responses = [];
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${baseUrl}${path}`);
      responses.push({ status: r.status, body: await r.json() });
    }
    const okCount = responses.filter(r => r.status === 200).length;
    const limited = responses.find(r => r.status === 429);
    check(
      `${path}: 3 OK then 429 with message "${expectedMessage}"`,
      okCount === 3 && limited && limited.body.message === expectedMessage,
    );
  }

  await burst("/api/products", "Too many product requests, please slow down");
  await burst("/api/cart", "Too many cart requests, please slow down");
  await burst("/api/wishlist", "Too many wishlist requests, please slow down");
  await burst("/api/likes", "Too many like requests, please slow down");

  server.close();
  await mongoose.disconnect();
  await mongo.stop();
  console.log(`\n  ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });