const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware identifies a user if a token is present, but doesn't block the request if not.
// This is useful for routes that can be accessed by both guests and logged-in users.
const identifyUser = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = await User.findById(decoded.id).select('-passwordHash');
    } catch (error) {
      // Don't throw an error, just proceed without a user
      console.error('Token verification failed, proceeding as guest.');
      req.user = null;
    }
  }
  
  // If there's a guestId in the header or body, attach it to the request
  const guestId = req.headers['x-guest-id'] || req.body.guestId;
  if (guestId) {
    req.guestId = guestId;
  }

  next();
};

// This middleware ensures that a user is logged in.
const protect = (req, res, next) => {
  identifyUser(req, res, () => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ message: 'Not authorized' });
    }
  });
};

module.exports = { identifyUser, protect };

