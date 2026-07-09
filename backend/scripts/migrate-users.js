/**
 * Migrate existing MongoDB users to Supabase Auth.
 *
 * Usage: node scripts/migrate-users.js
 *
 * Prerequisites:
 *   1. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env
 *   2. Users exist in the MongoDB `users` collection
 *
 * This script:
 *   - Reads all users from MongoDB
 *   - Creates corresponding users in Supabase Auth via admin API
 *   - Updates MongoDB users with their supabaseId
 *   - Logs results (passwords are NOT migrated — users must use "Forgot Password")
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");

const MONGO_URI = process.env.MONGO_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const users = await db.collection("users").find({ supabaseId: { $exists: false } }).toArray();

  console.log(`Found ${users.length} users to migrate.\n`);

  for (const user of users) {
    const email = user.email;
    const name = user.name || email?.split("@")[0] || "User";

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      console.error(`✗ ${email}: ${error.message}`);
      continue;
    }

    // Store the Supabase user ID in the MongoDB document
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { supabaseId: data.user.id } },
    );

    console.log(`✓ ${email} → supabaseId: ${data.user.id}`);
  }

  console.log("\nDone. Users must use 'Forgot Password' to set a password in Supabase.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
