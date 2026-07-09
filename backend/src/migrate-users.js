/**
 * Migrate existing Mongoose users to Better Auth schema.
 *
 * Reads from `users` (Mongoose) and writes to `user` + `account` (Better Auth).
 * Uses Better Auth's own MongoDB client exclusively (bson v6) to avoid version conflicts.
 *
 * Usage:  node src/migrate-users.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI is required");
  process.exit(1);
}

async function migrate() {
  // Use a single bson-v6 client for everything
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  // Read from the Mongoose `users` collection (data is just BSON, no version conflict)
  const existingUsers = await db.collection("users").find({}).toArray();
  console.log(`Found ${existingUsers.length} existing users`);

  let migrated = 0;
  let skipped = 0;

  for (const user of existingUsers) {
    const email = user.email;
    if (!email) {
      console.log(`  SKIP (no email): ${user._id}`);
      skipped++;
      continue;
    }

    // Check if already in Better Auth
    const exists = await db.collection("user").findOne({ email });
    if (exists) {
      console.log(`  SKIP (already migrated): ${email}`);
      skipped++;
      continue;
    }

    // Preserve the _id so existing references in other collections still work
    const uid = user._id;
    const now = new Date();

    // Insert into Better Auth `user` collection
    await db.collection("user").insertOne({
      _id: uid,
      name: user.name || email.split("@")[0],
      email: email,
      emailVerified: true,
      image: user.avatar || null,
      createdAt: user.createdAt || now,
      updatedAt: user.updatedAt || now,
    });

    // Insert into `account` collection for email/password auth
    // Better Auth expects: providerId="credential", accountId=user._id (hex string)
    if (user.passwordHash) {
      await db.collection("account").insertOne({
        _id: new (require("mongodb").ObjectId)(),
        userId: uid,
        accountId: uid.toString(),
        providerId: "credential",
        password: user.passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Additional account for OAuth-based auth (google, shopify, etc.)
    if (user.authProvider && user.authProvider !== "local" && user.email) {
      await db.collection("account").insertOne({
        _id: new (require("mongodb").ObjectId)(),
        userId: uid,
        accountId: user.email,
        providerId: user.authProvider,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`  MIGRATED: ${email} (${user.authProvider || "local"})`);
    migrated++;
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
  await client.close();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
