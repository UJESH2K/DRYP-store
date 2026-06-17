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
const rateLimit = require('express-rate-limit');

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

// Middlewares
// app.use(cors());
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allow all methods
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Sentry request handler — must come before any other middleware.
// Captures one transaction per HTTP request so we can see which route is slow.
if (Sentry && Sentry.Handlers) {
  app.use(Sentry.Handlers.requestHandler());
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Custom logging middleware to track API calls.
// IMPORTANT: do NOT log req.body directly. It can contain passwords, reset
// tokens, payment info, etc. We log method, path, and origin only. If you need
// more visibility, attach the data to req.log in the handler with the redacting
// logger in src/utils/logger.js.
app.use((req, res, next) => {
  logger.info(
    { method: req.method, path: req.path, origin: req.get("origin") || "localhost" },
    "api_call",
  );
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

    app.listen(PORT, "0.0.0.0", () =>
      logger.info(
        { port: PORT, env: process.env.NODE_ENV || "development" },
        "server_listening",
      ),
    );
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
