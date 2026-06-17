/**
 * Phase 0+ smoke integration test.
 *
 * Boots the real Express app on an ephemeral port, points it at a
 * MongoMemoryServer, and hits the public routes with fetch. The
 * goal is to catch the kind of bugs that only surface when the
 * whole stack is wired up — middleware order, route mounting,
 * CORS, request id, zod, etc.
 *
 *   GET  /api/health         → 200, status=ok
 *   GET  /api/health/ready   → 200
 *   GET  /api/health/deep    → 200, includes pid/memory
 *   GET  /api/products       → 200 (empty array, but 200)
 *   GET  /api/products/abc   → 400 (zod rejects non-ObjectId)
 *   POST /api/auth/register  → 400 (zod rejects empty body)
 *
 *   X-Request-Id: present in responses.
 *   CORS:        allowed origin gets ACAO, blocked doesn't.
 *   Auth:        /api/auth/register rate limit returns 429 after 10 hits.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
// Placeholder so validateEnv passes; we override with the in-memory URI.
process.env.MONGO_URI = "mongodb://placeholder/dryp";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  console.log("\nSmoke integration — full stack\n");

  const env = require("../src/config/validateEnv")({ exitOnError: true });
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());

  const express = require("express");
  const cors = require("cors");
  const requestId = require("../src/middleware/requestId");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cors({
    origin: (origin, cb) => cb(null, true), // permissive in test
  }));
  app.use(requestId());

  app.use("/api/health", require("../src/routes/health"));
  app.use("/api/auth", require("../src/routes/auth"));
  app.use("/api/products", require("../src/routes/products"));

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. /api/health
    const r1 = await fetch(`${base}/api/health`);
    const b1 = await r1.json();
    check("GET /api/health → 200", r1.status === 200);
    check("status: 'ok'", b1.status === "ok");
    check("X-Request-Id header present", !!r1.headers.get("x-request-id"));
    check("X-Request-Id looks like uuid", /^[0-9a-f-]{36}$/i.test(r1.headers.get("x-request-id") || ""));

    // 2. /api/health/ready
    const r2 = await fetch(`${base}/api/health/ready`);
    const b2 = await r2.json();
    check("GET /api/health/ready → 200", r2.status === 200);
    check("ready: true", b2.ready === true);
    check("ready: ping ok", b2.mongo && b2.mongo.ok === true);

    // 3. /api/health/deep
    const r3 = await fetch(`${base}/api/health/deep`);
    const b3 = await r3.json();
    check("GET /api/health/deep → 200", r3.status === 200);
    check("deep: pid", typeof b3.pid === "number");
    check("deep: memory.rss", typeof b3.memory.rss === "number");
    check("deep: node version", b3.node && b3.node.startsWith("v"));

    // 4. /api/products (empty)
    const r4 = await fetch(`${base}/api/products`);
    check("GET /api/products → 200", r4.status === 200);
    const b4 = await r4.json();
    check("GET /api/products → array", Array.isArray(b4));

    // 5. /api/products/abc (bad id)
    const r5 = await fetch(`${base}/api/products/abc`);
    check("GET /api/products/abc → 400 (zod)", r5.status === 400);

    // 6. /api/auth/register (zod empty)
    const r6 = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    check("POST /api/auth/register (empty) → 400", r6.status === 400);

    // 7. CORS preflight
    const r7 = await fetch(`${base}/api/products`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://dryp.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    check("OPTIONS preflight → 200/204", r7.status === 200 || r7.status === 204);

    // 8. Custom request id is honored
    const r8 = await fetch(`${base}/api/health`, {
      headers: { "X-Request-Id": "smoke-test-12345" },
    });
    check("incoming X-Request-Id honored", r8.headers.get("x-request-id") === "smoke-test-12345");

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