const jwt = require("jsonwebtoken");
const User = require("../models/User");

const identifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer")
      ? authHeader.split(" ")[1]
      : null;

  if (token && token !== "null" && token !== "undefined") {
    try {
      // 1. Try Supabase verification
      let sbUser;
      try {
        const { getSupabaseAdmin } = require("../lib/supabase");
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) sbUser = data.user;
      } catch {
        // supabase not configured yet — skip
      }

      if (sbUser) {
        let user = await User.findOne({ supabaseId: sbUser.id });
        if (!user) {
          user = await User.create({
            supabaseId: sbUser.id,
            name:
              sbUser.user_metadata?.full_name ||
              sbUser.email?.split("@")[0] ||
              "User",
            email: sbUser.email,
            authProvider: sbUser.app_metadata?.provider === "email" ? "email" : sbUser.app_metadata?.provider || "local",
          });
        }
        req.user = user;
      }

      // 2. Fallback: verify old JWT format (pre-migration tokens)
      if (!req.user) {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          const decoded = jwt.verify(token, secret);
          const user = await User.findById(decoded.id).select("-passwordHash");
          if (user) req.user = user;
        }
      }

      // 3. Single isActive check
      if (req.user && !req.user.isActive) {
        console.warn(`Blocked access attempt by suspended user: ${req.user._id}`);
        return res.status(403).json({ message: "Account suspended." });
      }

      if (req.user) return next();
    } catch (error) {
      console.error(`Auth Middleware: ${error.message}.`);
    }
  }

  req.user = null;
  next();
};

const protect = (req, res, next) => {
  identifyUser(req, res, () => {
    if (req.user) next();
    else res.status(401).json({ message: "Not authorized" });
  });
};

module.exports = { identifyUser, protect };
