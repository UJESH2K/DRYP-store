require("dotenv").config();

// CRITICAL: validateEnv must run before any module that depends on JWT_SECRET
// (which is most of the app). It exits the process with a clear error if a
// required env var is missing — never silently falls back to a default secret.
const env = require("./src/config/validateEnv")({ exitOnError: true });

// Sentry must be initialized FIRST so it captures errors from every other
// require() below. Safe no-op if SENTRY_DSN is empty or @sentry/node isn't
// installed.
const Sentry = require("./src/config/sentry")();

const express = require("express");
const cors = require("cors");
const path = require("path"); // Import path module
const connectDatabase = require("./src/config/database");
const logger = require("./src/utils/logger");
const healthRoutes = require("./src/routes/health");

// Route imports
const authRoutes = require("./src/routes/auth");
const productRoutes = require("./src/routes/products");
const vendorRoutes = require("./src/routes/vendors");
const orderRoutes = require("./src/routes/orders");
const likeRoutes = require("./src/routes/likes");
const wishlistRoutes = require("./src/routes/wishlist");
const paymentRoutes = require("./src/routes/payments");
const userRoutes = require("./src/routes/users");
const uploadRoutes = require("./src/routes/upload"); // Import the new upload route
const analyticsRoutes = require("./src/routes/analytics"); // Import analytics routes
const vendorAnalyticsRoutes = require("./src/routes/analytics/vendor");
const cartRoutes = require("./src/routes/cart");
const reviewRoutes = require("./src/routes/reviews");
const rateLimit = require('express-rate-limit');
const requestId = require("./src/middleware/requestId");
const { registerAll: registerJobs } = require("./src/jobs");
const reservation = require("./src/utils/stockReservation");

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10, 
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const vendorSignupLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: { message: "Too many studio applications from this IP, please try again later" },
});

// Per-resource limiters. The defaults are:
//   products  — read-heavy (browse/catalogue). 200/min per IP.
//   cart      — guest or authed. 60/min per IP.
//   wishlist  — guest or authed. 60/min per IP.
//   likes     — high-frequency toggle from the swipe UI. 120/min per IP.
// These are deliberately generous; they're meant to stop a runaway
// script, not to gate normal users. If a real user hits them, the
// error message names the resource so support can investigate.
const productsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { message: "Too many product requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});
const cartLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { message: "Too many cart requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});
const wishlistLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { message: "Too many wishlist requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});
const likesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { message: "Too many like requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Trust the first proxy hop (AWS ELB / nginx). Without this, rate
// limiters and `req.ip` see the proxy's IP for every request and
// either ban everyone or allow everyone through. Only safe when
// there is a proxy in front — on bare metal / local dev this still
// works because there's only one hop.
app.set("trust proxy", 1);

// Disable the X-Powered-By header (defense in depth; helmet also does
// this but we set it early so even pre-helmet error paths don't leak).
app.disable("x-powered-by");

// Middlewares
//
// CORS strategy:
//   - For mobile (Expo / React Native), CORS doesn't apply — the app
//     doesn't run in a browser, so cross-origin policy is irrelevant.
//   - For the website (Vercel) and any other browser-based client, we
//     want to allow only known origins. Set CORS_ORIGINS to a
//     comma-separated list (e.g. "https://dryp.com,https://www.dryp.com").
//   - When CORS_ORIGINS is unset (dev), we fall back to "*" so the
//     local Expo Web build, the Next.js dev server, and a manual
//     curl/postman all still work.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, cb) {
    // No origin = same-origin / mobile / curl — allow.
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true); // dev fallback
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Phase 5B: stamp every request with a UUID for log correlation.
app.use(requestId());

// Sentry request handler — must come before any other middleware.
// Captures one transaction per HTTP request so we can see which route is slow.
if (Sentry && Sentry.Handlers) {
  app.use(Sentry.Handlers.requestHandler());
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Custom logging middleware to track API calls.
// IMPORTANT: do NOT log req.body directly. It can contain passwords, reset
// tokens, payment info, etc. We log method, path, origin, and the request
// id (set above) so a single failed request can be grep'd by id. If you
// need more visibility, attach the data to req.log in the handler with the
// redacting logger in src/utils/logger.js.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        reqId: req.id,
        origin: req.get("origin") || "localhost",
      },
      "api_call",
    );
  });
  next();
});

// Health check
app.use("/api/health", healthRoutes);

// API routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/vendors/register", vendorSignupLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/products", productsLimiter, productRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/likes", likesLimiter, likeRoutes);
app.use("/api/wishlist", wishlistLimiter, wishlistRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes); // Use the upload route
app.use("/api/analytics", analyticsRoutes); // Use the analytics route
app.use("/api/analytics", vendorAnalyticsRoutes);
app.use("/api/cart", cartLimiter, cartRoutes);
app.use("/api", reviewRoutes); // /products/:id/reviews and /reviews/:id
// IMPORTANT: reviewRoutes is mounted BEFORE the not-found handler
// but AFTER the more-specific route trees so that /api/products
// keeps serving its own routes and reviewRoutes is consulted only
// for /api/products/:id/reviews and /api/reviews/:reviewId.

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error({ err, stack: err.stack }, "unhandled_error");
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

// Sentry error handler — must come AFTER the global error handler above so
// it can also see and report those errors. Skipped when Sentry is a no-op.
if (Sentry && Sentry.Handlers) {
  app.use(Sentry.Handlers.errorHandler());
}

const PORT = process.env.PORT || 8080; // Backend runs on port 8080

// Start server
(async () => {
  try {
    await connectDatabase(process.env.MONGO_URI);

    // Phase 0E: register all background workers. In-proc mode
    // attaches handlers to the queue; BullMQ mode spins up workers.
    registerJobs();

    // Phase 4A: periodic stock-reservation sweeper. Without this
    // the in-memory hold store grows unbounded across the lifetime
    // of the process. Every 5 min we drop holds past their TTL.
    // Cheap; runs in ~1ms on an empty store.
    const sweepInterval = setInterval(() => {
      try {
        const freed = reservation.sweep();
        if (freed > 0) {
          logger.info({ freed }, "reservation_sweeper_freed");
        }
      } catch (e) {
        logger.error({ err: e.message }, "reservation_sweeper_error");
      }
    }, 5 * 60 * 1000);
    sweepInterval.unref(); // don't keep the process alive just for this

    const server = app.listen(PORT, "0.0.0.0", () =>
      logger.info(
        { port: PORT, env: process.env.NODE_ENV || "development" },
        "server_listening",
      ),
    );

    // Graceful shutdown. ECS / Kubernetes send SIGTERM on a deploy
    // and give us ~30s to drain. We stop accepting new connections,
    // wait for in-flight requests, and then exit. Without this, an
    // in-flight request gets TCP RST and the user sees a 502 on
    // deploy.
    const shutdown = (signal) => {
      logger.info({ signal }, "shutdown_initiated");
      clearInterval(sweepInterval);
      server.close((err) => {
        if (err) {
          logger.error({ err: err.message }, "shutdown_error");
          process.exit(1);
        }
        // Close the Mongo connection if present.
        const mongoose = require("mongoose");
        mongoose.connection.close().then(
          () => {
            logger.info("shutdown_complete");
            process.exit(0);
          },
          (e) => {
            logger.error({ err: e.message }, "mongo_close_error");
            process.exit(1);
          },
        );
      });
      // Hard cap: if drain takes more than 25s, force-exit. The
      // orchestrator will SIGKILL us at 30s anyway.
      setTimeout(() => {
        logger.error("shutdown_timeout_forcing_exit");
        process.exit(1);
      }, 25_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Log unhandled rejections but don't crash the process — Mongoose
    // can occasionally throw on a query whose response we've already
    // sent. We want Sentry to see these (the logger will pipe to
    // Sentry if it's configured) but a deploy restart from a single
    // unhandled promise is too aggressive.
    process.on("unhandledRejection", (reason) => {
      logger.error(
        { err: reason && reason.message, stack: reason && reason.stack },
        "unhandled_rejection",
      );
    });
  } catch (error) {
    // We intentionally do NOT start the server when MongoDB is unreachable.
    // A "listening but every query 500s" process hides outages and wastes
    // the deploy slot on AWS — fail fast so the orchestrator can restart us
    // (or a human can investigate) and we never serve a broken API.
    logger.error(
      { err: error.message, stack: error.stack },
      "mongo_connection_failed_refusing_to_start",
    );
    process.exit(1);
  }
})();

module.exports = app;
