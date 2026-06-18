/**
 * Phase 6 — Push token registration.
 *
 *   POST   /api/users/push-token  → 200, 401, 400 (bad schema)
 *   DELETE /api/users/push-token  → 200, 400 (missing token)
 *
 * Idempotency: re-registering the same token updates the
 * metadata but does not create a second entry.
 *
 * We also exercise the sendPush helper with no Expo network
 * dependency — by stubbing global.fetch — to confirm a
 * DeviceNotRegistered response removes the dead token.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.MONGO_URI = "mongodb://placeholder/dryp";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function token(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

(async () => {
  console.log("\nPhase 6 — Push notifications\n");

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
    const user = await User.create({
      name: "T", email: "t@x.com", passwordHash: "x",
    });
    const tok = token(user._id);

    // 1. No auth → 401
    const r1 = await fetch(`${base}/api/users/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "ExponentPushToken[abc]", platform: "ios" }),
    });
    check("no auth → 401", r1.status === 401);

    // 2. Bad schema → 400
    const r2 = await fetch(`${base}/api/users/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: "x", platform: "win95" }),
    });
    check("bad schema → 400", r2.status === 400);

    // 3. Valid → 200
    const r3 = await fetch(`${base}/api/users/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: "ExponentPushToken[abc]", platform: "ios" }),
    });
    check("register → 200", r3.status === 200);
    const b3 = await r3.json();
    check("count = 1", b3.count === 1);

    // 4. Re-register same token → 200, count still 1
    const r4 = await fetch(`${base}/api/users/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: "ExponentPushToken[abc]", platform: "ios" }),
    });
    check("re-register → 200", r4.status === 200);
    const b4 = await r4.json();
    check("idempotent: count = 1", b4.count === 1);

    // 5. Different token → 2
    const r5 = await fetch(`${base}/api/users/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: "ExponentPushToken[def]", platform: "android" }),
    });
    check("add android → 200", r5.status === 200);
    const b5 = await r5.json();
    check("count = 2", b5.count === 2);

    // 6. Delete one token
    const r6 = await fetch(`${base}/api/users/push-token`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token: "ExponentPushToken[abc]" }),
    });
    check("delete → 200", r6.status === 200);
    const b6 = await r6.json();
    check("count = 1 after delete", b6.count === 1);

    // 7. sendPush helper: stub fetch, send to one good + one
    //    dead token, confirm dead is removed.
    const User2 = require("../src/models/User");
    const u2 = await User2.create({
      name: "U2", email: "u2@x.com", passwordHash: "x",
      pushTokens: [
        { token: "ExponentPushToken[good]", platform: "ios" },
        { token: "ExponentPushToken[dead]", platform: "ios" },
      ],
    });
    // Stub global.fetch: return ok for [good], DeviceNotRegistered for [dead].
    const origFetch = global.fetch;
    global.fetch = (url, opts) => {
      const body = JSON.parse(opts.body);
      const to = body.to;
      const isDead = to.includes("dead");
      return Promise.resolve({
        json: () => Promise.resolve({
          data: [{
            status: isDead ? 'error' : 'ok',
            ...(isDead ? { details: { error: 'DeviceNotRegistered' } } : {}),
          }],
        }),
      });
    };
    const { sendPush } = require("../src/utils/pushNotifications");
    const result = await sendPush([u2._id], { title: "hi", body: "test" });
    global.fetch = origFetch;
    check("sendPush sent = 1", result.sent === 1);
    check("sendPush dead = 1", result.dead === 1);
    const after = await User2.findById(u2._id);
    check("dead token removed", after.pushTokens.length === 1);
    check("good token kept", after.pushTokens[0].token === "ExponentPushToken[good]");

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