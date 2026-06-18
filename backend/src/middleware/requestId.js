/**
 * requestId.js — Phase 5B. Request ID middleware.
 *
 * Generates a UUID per request and stamps it on `req.id`, the
 * `X-Request-Id` response header, and (if available) a child logger
 * bound to `req.log`. This makes it trivial to grep CloudWatch
 * for a single failed request, and lets the load balancer
 * correlate a 502 back to the backend log line.
 *
 * Honors an incoming `X-Request-Id` header (e.g. from the
 * load balancer) so the same id flows end-to-end.
 */
const crypto = require("crypto");

const HEADER = "x-request-id";
const MAX_LEN = 200;

module.exports = function requestId() {
  return (req, res, next) => {
    let id = req.get(HEADER);
    if (!id || id.length > MAX_LEN) {
      id = crypto.randomUUID();
    }
    req.id = id;
    res.setHeader("X-Request-Id", id);

    // Bind a child logger if the request already has one. The
    // base server.js logger doesn't do this today, but exposing
    // `req.id` lets future handlers (or a future pino-http upgrade)
    // attach it without re-plumbing.
    if (req.log && typeof req.log.child === "function") {
      req.log = req.log.child({ reqId: id });
    }
    next();
  };
};