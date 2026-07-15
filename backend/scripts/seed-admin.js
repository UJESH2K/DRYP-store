/**
 * Ensure an admin user exists for the connected MongoDB.
 *
 * Usage:
 *   node scripts/seed-admin.js
 *   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=secret node scripts/seed-admin.js
 *
 * Reads MONGO_URI from backend/.env (or process env).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const EMAIL = process.env.ADMIN_EMAIL || "admin@dryp.store";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }
  if (PASSWORD.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash(PASSWORD, 10);
  const existing = await db.collection("users").findOne({ email: EMAIL });

  if (existing) {
    await db.collection("users").updateOne(
      { email: EMAIL },
      {
        $set: {
          role: "admin",
          isActive: true,
          passwordHash: hash,
          authProvider: "local",
        },
      },
    );
    console.log(`Updated admin: ${EMAIL}`);
  } else {
    await db.collection("users").insertOne({
      email: EMAIL,
      passwordHash: hash,
      name: "Admin",
      role: "admin",
      isActive: true,
      authProvider: "local",
      createdAt: new Date(),
      preferences: { currency: "USD", categories: [], colors: [], brands: [] },
    });
    console.log(`Created admin: ${EMAIL}`);
  }

  const apps = await db.collection("vendorapplications").countDocuments();
  console.log(`DB=${db.databaseName} vendorapplications=${apps}`);
  console.log(`Login: ${EMAIL} / ${PASSWORD}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
