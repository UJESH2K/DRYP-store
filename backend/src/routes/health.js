const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint for monitoring / load balancers
 * @access  Public
 *
 * Returns:
 *   - 200 OK with { status: "ok", mongo: "connected", uptime, timestamp }
 *   - 503 Service Unavailable with { status: "degraded", mongo: "disconnected", ... }
 *
 * Used by uptime monitoring, AWS load balancer health checks, and
 * the Vercel pre-deploy probe. Caches mongo state for 5s to avoid
 * hammering the connection on every health check.
 */
let lastMongoCheck = { state: null, at: 0 };
const MONGO_CHECK_TTL_MS = 5_000;

function getMongoState() {
  const now = Date.now();
  if (now - lastMongoCheck.at < MONGO_CHECK_TTL_MS && lastMongoCheck.state) {
    return lastMongoCheck.state;
  }
  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const readyState = mongoose.connection.readyState;
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const state = stateMap[readyState] || "unknown";
  lastMongoCheck = { state, at: now };
  return state;
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

module.exports = router;
