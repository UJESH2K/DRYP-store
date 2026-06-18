const { protect } = require('./auth');

/**
 * Middleware to check if the authenticated user has the required role(s)
 * @param {string|string[]} requiredRoles - Single role or array of roles (e.g., 'vendor' or ['admin', 'vendor'])
 * @returns {Function} Express middleware function
 */
const requireRole = (requiredRoles) => {
  // Normalize to array for consistent checking
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    // Run the protect middleware first to ensure we have a user
    protect(req, res, () => {
      if (!req.user) {
        // This should never happen since protect handles 401, but defensive
        return res.status(401).json({ message: "Not authorized" });
      }

      if (roles.includes(req.user.role)) {
        next(); // User has the required role
      } else {
        res.status(403).json({ message: "Insufficient privileges" });
      }
    });
  };
};

/**
 * Shorthand middleware for vendor-only routes
 */
const requireVendor = requireRole('vendor');

/**
 * Shorthand middleware for admin-only routes
 */
const requireAdmin = requireRole('admin');

/**
 * Shorthand middleware for vendor or admin routes
 */
const requireVendorOrAdmin = requireRole(['vendor', 'admin']);

module.exports = {
  requireRole,
  requireVendor,
  requireAdmin,
  requireVendorOrAdmin,
};