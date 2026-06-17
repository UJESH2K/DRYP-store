/**
 * Phase 0D health check test
 *
 * Verifies the new /api/health route:
 *   - returns 200 + { status: "ok", mongo: "connected" } when DB is reachable
 *   - returns 503 + { status: "degraded", ... } when DB is disconnected
 *
 * Strategy: mount the route on a throwaway express app bound to an ephemeral
 * port, then probe it with fetch. No real MongoDB needed — we flip
 * mongoose.connection.readyState directly to simulate the two states.
 */

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const healthRoutes = require("../src/routes/health");

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

/**
 * Build a tiny express app bound to an ephemeral port and return
 * { baseUrl, close }.
 */
function startMiniServer() {
  return new Promise((resolve) => {
    const app = express();
    app.use("/api/health", healthRoutes);
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function run() {
  console.log("\nPhase 0D — health check\n");

  // ---- Test 1: server is reachable when DB is up ----
  // Mongoose readyState=1 means connected. We can't trivially force this
  // without a real connection, but we CAN force readyState=0 (disconnected)
  // and readyState=2 (connecting) for negative tests.
  const s1 = await startMiniServer();
  // Force connected state by stubbing readyState (the route caches 5s, so we
  // wait 5.1s before re-checking).
  const origReadyState = Object.getOwnPropertyDescriptor(
    mongoose.connection,
    "readyState",
  );
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });

  const r1 = await fetch(`${s1.baseUrl}/api/health`);
  const b1 = await r1.json();
  check("connected mongo → 200", r1.status === 200);
  check("connected mongo → status: 'ok'", b1.status === "ok");
  check("connected mongo → mongo: 'connected'", b1.mongo === "connected");
  check("response includes uptime (number)", typeof b1.uptime === "number");
  check("response includes timestamp (string)", typeof b1.timestamp === "string");

  // ---- Test 2: degraded when DB is down ----
  // Wait past the 5s cache TTL — the simplest way is to just wait.
  // (For a test we could mock Date.now, but waiting is fine here.)
  await new Promise((r) => setTimeout(r, 5100));
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 0,
    configurable: true,
  });

  const r2 = await fetch(`${s1.baseUrl}/api/health`);
  const b2 = await r2.json();
  check("disconnected mongo → 503", r2.status === 503);
  check("disconnected mongo → status: 'degraded'", b2.status === "degraded");
  check("disconnected mongo → mongo: 'disconnected'", b2.mongo === "disconnected");

  // ---- Restore mongoose state ----
  if (origReadyState) {
    Object.defineProperty(mongoose.connection, "readyState", origReadyState);
  }

  await s1.close();

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
