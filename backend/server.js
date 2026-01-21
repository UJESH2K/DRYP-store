require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = 'morgan';
const path = require('path'); // Import path module
const connectDatabase = require('./src/config/database');

// Route imports
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const vendorRoutes = require('./src/routes/vendors');
const orderRoutes = require('./src/routes/orders');
const likeRoutes = require('./src/routes/likes');
const wishlistRoutes = require('./src/routes/wishlist');
const paymentRoutes = require('./src/routes/payments');
const userRoutes = require('./src/routes/users');
const uploadRoutes = require('./src/routes/upload'); // Import the new upload route
const analyticsRoutes = require('./src/routes/analytics'); // Import analytics routes
const vendorAnalyticsRoutes = require('./src/routes/analytics/vendor');

const app = express();

// Middlewares
// app.use(cors());
app.use(cors({
  origin: '*', // Allow all origins
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow all methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Custom logging middleware to track API calls
app.use((req, res, next) => {
  console.log(`
🔥 API CALL: ${req.method} ${req.path}`);
  console.log(`📱 From: ${req.get('origin') || 'localhost'}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes); // Use the upload route
app.use('/api/analytics', analyticsRoutes); // Use the analytics route
app.use('/api/analytics', vendorAnalyticsRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000; // Backend runs on port 5000

// Start server
(async () => {
  try {
    await connectDatabase(process.env.MONGO_URI);
  } catch (error) {
    console.warn('Starting server without database connection:', error.message);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT} and accessible from all interfaces`));
})();

module.exports = app;