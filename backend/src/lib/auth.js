const { MongoClient } = require("mongodb");
const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { bearer } = require("better-auth/plugins/bearer");
const { jwt } = require("better-auth/plugins/jwt");
const bcrypt = require("bcryptjs");

let authInstance = null;
let baClient = null;

async function getAuth() {
  if (authInstance) return authInstance;

  // Better Auth needs its own MongoDB client (bson v6) separate from Mongoose (bson v5)
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");
  baClient = new MongoClient(uri);
  const db = baClient.db();

  authInstance = betterAuth({
    appName: "DRYP",
    baseURL: process.env.BETTER_AUTH_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080",
    database: mongodbAdapter(db, {
      client: baClient,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: false,
      autoSignIn: true,
      password: {
        hash: async (password) => {
          return bcrypt.hash(password, 10);
        },
        verify: async ({ hash, password }) => {
          return bcrypt.compare(password, hash);
        },
      },
      sendResetPassword: async ({ user, url, token }, request) => {
        // Will wire up the existing sendEmail utility
        console.log(`[Better Auth] Password reset requested for ${user.email}: ${url}`);
      },
      resetPasswordTokenExpiresIn: 600,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    plugins: [bearer(), jwt()],
    // Tweak API paths to match the existing frontend expectations
    // Better Auth defaults:
    //   sign-in/email, sign-up/email, sign-out, session, etc.
    advanced: {
      defaultCookiePrefix: "dryp",
      crossSubDomainCookies: {
        enabled: false,
      },
    },
  });

  return authInstance;
}

function getAuthSync() {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call initAuth() first.");
  }
  return authInstance;
}

module.exports = { getAuth, getAuthSync };
