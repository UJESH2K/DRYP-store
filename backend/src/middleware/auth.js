const jwt = require("jsonwebtoken");
const User = require("../models/User");

const identifyUser = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      if (!token || token === "null" || token === "undefined") {
        throw new Error("Token is missing or stringified null/undefined");
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET missing");

      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select("-passwordHash");

      if (user && !user.isActive) {
        console.warn(`Blocked access attempt by suspended user: ${user._id}`);
        return res.status(403).json({ message: "Account suspended." });
      }

      req.user = user;
    } catch (error) {
      console.error(`Auth Middleware: ${error.message}. Proceeding as guest.`);
      req.user = null;
    }
  }

  const guestId = req.headers["x-guest-id"] || req.body.guestId;
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
      res.status(401).json({ message: "Not authorized" });
    }
  });
};

module.exports = { identifyUser, protect };
