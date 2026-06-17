const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Liveness probe for load balancers. Returns 200 as long as
 *          the Node process is up. The Mongo check is a state read
 *          only (no ping), so this stays sub-millisecond.
 *
 * @route   GET /api/health/ready
 * @desc    Readiness probe. Pings MongoDB and actually verifies a
 *          query succeeds. Use this in ECS / Kubernetes readiness
 *          checks — the load balancer will pull traffic from a
 *          degraded instance.
 *
 * @route   GET /api/health/deep
 * @desc    Verbose report for debugging. Includes memory, version,
 *          mongo ping time, and uptime. Not used by the load
 *          balancer; safe to hit manually.
 *
 * @access  Public (the load balancer doesn't have credentials)
 */
let lastMongoCheck = { state: null, at: 0 };
const MONGO_CHECK_TTL_MS = 5_000;

function getMongoState() {
  const now = Date.now();
  if (now - lastMongoCheck.at < MONGO_CHECK_TTL_MS && lastMongoCheck.state) {
    return lastMongoCheck.state;
  }
  const readyState = mongoose.connection.readyState;
  const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const state = stateMap[readyState] || "unknown";
  lastMongoCheck = { state, at: now };
  return state;
}

async function pingMongo(timeoutMs = 1500) {
  if (mongoose.connection.readyState !== 1) {
    return { ok: false, error: `state=${mongoose.connection.readyState}` };
  }
  const start = Date.now();
  try {
    // admin ping is the lightest possible DB call.
    const p = mongoose.connection.db.admin().ping();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("ping timeout")), timeoutMs),
    );
    await Promise.race([p, timeout]);
    return { ok: true, pingMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: e.message, pingMs: Date.now() - start };
  }
}

router.get("/", (_req, res) => {
  const mongoState = getMongoState();
  const isHealthy = mongoState === "connected";
  const body = {
    status: isHealthy ? "ok" : "degraded",
    mongo: mongoState,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  };
  res.status(isHealthy ? 200 : 503).json(body);
});

router.get("/ready", async (_req, res) => {
  const ping = await pingMongo();
  const body = {
    ready: ping.ok,
    mongo: ping,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.status(ping.ok ? 200 : 503).json(body);
});

router.get("/deep", async (_req, res) => {
  const ping = await pingMongo();
  const mem = process.memoryUsage();
  const body = {
    status: ping.ok ? "ok" : "degraded",
    mongo: ping,
    uptime: process.uptime(),
    node: process.version,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    pid: process.pid,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  };
  res.status(ping.ok ? 200 : 503).json(body);
});

module.exports = router;