/**
 * Phase 5C — CORS origin policy test.
 *  - no CORS_ORIGINS set: allow * (dev)
 *  - CORS_ORIGINS list set: only listed origins get Access-Control-Allow-Origin
 *  - blocked origin gets no ACAO header (browser would block)
 *  - same-origin / no origin is always allowed
 *  - preflight (OPTIONS) is allowed for configured origins
 */

process.env.NODE_ENV = "test";
delete process.env.CORS_ORIGINS; // start in dev (allow *)

const express = require("express");
const http = require("http");
const cors = require("cors");

function buildApp() {
  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const opts = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`blocked`));
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
  };
  const app = express();
  app.use(cors(opts));
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  return app;
}

function start() {
  return new Promise((resolve) => {
    const app = buildApp();
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  // 1. dev mode: any origin allowed
  let s = await start();
  const r1 = await fetch(`${s.baseUrl}/probe`, {
    headers: { Origin: "http://localhost:3000" },
  });
  check("dev: ACAO echoes origin", r1.headers.get("access-control-allow-origin") === "http://localhost:3000");
  await s.close();

  // 2. configured: only listed
  process.env.CORS_ORIGINS = "https://dryp.com,https://www.dryp.com";
  s = await start();

  // 2a. allowed origin
  const r2a = await fetch(`${s.baseUrl}/probe`, {
    headers: { Origin: "https://dryp.com" },
  });
  check("configured: allowed origin gets ACAO", r2a.headers.get("access-control-allow-origin") === "https://dryp.com");

  // 2b. second allowed
  const r2b = await fetch(`${s.baseUrl}/probe`, {
    headers: { Origin: "https://www.dryp.com" },
  });
  check("configured: second allowed", r2b.headers.get("access-control-allow-origin") === "https://www.dryp.com");

  // 2c. disallowed — no ACAO header
  const r2c = await fetch(`${s.baseUrl}/probe`, {
    headers: { Origin: "https://evil.com" },
  });
  check("configured: evil.com blocked (no ACAO)", r2c.headers.get("access-control-allow-origin") === null);

  // 2d. no origin (mobile/curl)
  const r2d = await fetch(`${s.baseUrl}/probe`);
  check("configured: no origin allowed (mobile/curl)", r2d.status === 200);
  await s.close();

  // 3. preflight OPTIONS
  process.env.CORS_ORIGINS = "https://dryp.com";
  s = await start();
  const r3 = await fetch(`${s.baseUrl}/probe`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://dryp.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  check("preflight: allowed origin returns 200/204", r3.status === 200 || r3.status === 204);
  check("preflight: ACAM header present", r3.headers.get("access-control-allow-methods") !== null);
  await s.close();

  delete process.env.CORS_ORIGINS;

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();