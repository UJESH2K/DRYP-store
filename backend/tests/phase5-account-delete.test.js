/**
 * Phase 5 — Account deletion.
 *
 *   DELETE /api/users/me  → 200 (correct password + confirmation
 *                                text), 401 (wrong password), 400
 *                                (missing fields).
 *
 * After deletion:
 *   - the user is anonymized (name="Deleted user",
 *     email=deleted+<id>@dryp.invalid)
 *   - isDeleted = true
 *   - subsequent calls with the same JWT are rejected.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.MONGO_URI = "mongodb://placeholder/dryp";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function token(userId, role = "user") {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("\nPhase 5 — Account deletion\n");

  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri());

  const express = require("express");
  const cors = require("cors");
  const requestId = require("../src/middleware/requestId");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cors());
  app.use(requestId());

  const userRoutes = require("../src/routes/users");
  app.use("/api/users", userRoutes);

  const http = require("http");
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const User = require("../src/models/User");
    const passwordHash = await bcrypt.hash("hunter2", 4);
    const user = await User.create({
      name: "Real",
      email: "real@x.com",
      passwordHash,
    });
    const tok = token(user._id);

    // 1. No auth → 401
    const r1 = await fetch(`${base}/api/users/me`, { method: "DELETE" });
    check("no auth → 401", r1.status === 401);

    // 2. Missing fields → 400
    const r2 = await fetch(`${base}/api/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({}),
    });
    check("empty body → 400", r2.status === 400);

    // 3. Wrong confirmation text → 400
    const r3 = await fetch(`${base}/api/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ password: "hunter2", confirmText: "delete" }),
    });
    check("wrong confirmText → 400", r3.status === 400);

    // 4. Wrong password → 401
    const r4 = await fetch(`${base}/api/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ password: "nope", confirmText: "DELETE MY ACCOUNT" }),
    });
    check("wrong password → 401", r4.status === 401);

    // 5. Correct → 200
    const r5 = await fetch(`${base}/api/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ password: "hunter2", confirmText: "DELETE MY ACCOUNT" }),
    });
    check("correct → 200", r5.status === 200);

    // 6. User is now anonymized
    const after = await User.findById(user._id);
    check("name = 'Deleted user'", after.name === "Deleted user");
    check("email anonymized", after.email === `deleted+${user._id}@dryp.invalid`);
    check("isDeleted = true", after.isDeleted === true);
    check("deletedAt set", after.deletedAt instanceof Date);

    // 7. Subsequent calls with the same token are rejected
    const r7 = await fetch(`${base}/api/users/profile`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    check("deleted user blocked → 401", r7.status === 401);

  } finally {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  }

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});