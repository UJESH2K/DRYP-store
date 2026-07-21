require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET must be set in .env");
  process.exit(1);
}
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path"); // Import path module
const connectDatabase = require("./src/config/database");

// Route imports
const authRoutes = require("./src/routes/auth");
const shopifyAuthRoutes = require("./src/routes/shopifyAuth");
const googleAuthRoutes = require("./src/routes/googleAuth");
const productRoutes = require("./src/routes/products");
const vendorRoutes = require("./src/routes/vendors");
const orderRoutes = require("./src/routes/orders");
const likeRoutes = require("./src/routes/likes");
const wishlistRoutes = require("./src/routes/wishlist");
const paymentRoutes = require("./src/routes/payments");
const userRoutes = require("./src/routes/users");
const uploadRoutes = require("./src/routes/upload"); // Import the new upload route
const mediaRoutes = require("./src/routes/media");
const analyticsRoutes = require("./src/routes/analytics"); // Import analytics routes
const vendorAnalyticsRoutes = require("./src/routes/analytics/vendor");
const cartRoutes = require("./src/routes/cart");
const aiRoutes = require("./src/routes/ai");
const stylistRoutes = require("./src/routes/stylist");
const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === "production";

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 10 : 50,
  message: { message: "Too many authentication attempts from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const vendorSignupLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 5 : 50,
  message: { message: "Too many signup attempts from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const vendorApplyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 5 : 20,
  message: { message: "Too many studio applications from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const googleRegistrationDraftLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 10 : 50,
  message: { message: "Too many draft creation attempts from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const googleAuthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 10 : 50,
  message: { message: "Too many Google authentication attempts from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const shopifyAuthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isProduction ? 10 : 50,
  message: { message: "Too many Shopify authentication attempts from this IP. Please wait 1 minute and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Express app
const app = express();
const http = require("http");

// Create HTTP server with increased header size to handle proxied cookies from Next.js
const server = http.createServer({ maxHeaderSize: 32768 }, app);

// Trust proxy (needed for rate limiting behind nginx reverse proxy)
app.set('trust proxy', 1);

// Middlewares
// app.use(cors());
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allow all methods
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-id"],
  }),
);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Custom logging middleware to track API calls
app.use((req, res, next) => {
  console.log(`
🔥 API CALL: ${req.method} ${req.path}`);
  console.log(`📱 From: ${req.get("origin") || "localhost"}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/vendors/register", vendorSignupLimiter);
app.use("/api/vendors/apply", vendorApplyLimiter);
app.use("/api/vendors/google-registration-drafts", googleRegistrationDraftLimiter);
app.use("/api/auth/shopify", shopifyAuthLimiter);
app.use("/api/auth/google", googleAuthLimiter);

app.use("/api/auth/shopify", shopifyAuthRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload", uploadRoutes); // Use the upload route
app.use("/api/media", mediaRoutes);
app.use("/api/analytics", analyticsRoutes); // Use the analytics route
app.use("/api/analytics", vendorAnalyticsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/stylist", stylistRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 8081; // Backend runs on port from .env (currently 8081)

// Start server
(async () => {
  try {
    await connectDatabase(process.env.MONGO_URI);

    const agenda = require("./src/config/agenda");
    require("./src/jobs/shopifyImport")(agenda);
    await agenda.start();

    server.listen(PORT, "0.0.0.0", () =>
    console.log(
        `Server running on port ${PORT} and accessible from all interfaces`,
      ),
    );
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exitCode = 1;
  }
})();

module.exports = app;
