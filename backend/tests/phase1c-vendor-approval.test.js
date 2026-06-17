/**
 * Phase 1C — vendor approval atomicity
 *
 * Verifies the fix for the bug where the application was marked "approved"
 * in Mongo but the email send failed, leaving the DB in an inconsistent
 * state.
 *
 * Strategy: stub `sendEmail` to throw, then call the route and assert:
 *   - response is 502 (Bad Gateway)
 *   - the application in the DB is still in its prior state
 *   - on the next call with a working email, the state is committed
 */

// Set env vars BEFORE requiring the app, so the auth middleware picks them up.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://placeholder";

const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const VendorApplication = require("../src/models/VendorApplication");
const User = require("../src/models/User");
const MongoMemoryServer = require("mongodb-memory-server").MongoMemoryServer;

let mongo;
let server;
let baseUrl;
let adminToken;
let adminUser;

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

/**
 * Build a fresh express app with a fresh vendors route module and start
 * the server on an ephemeral port. sendEmail is monkey-patched to the
 * given stub (so we can simulate success and failure).
 */
async function startServer(sendEmailStub) {
  // Wipe the vendors route from the require cache so it re-requires
  // sendEmail fresh.
  delete require.cache[require.resolve("../src/routes/vendors")];
  delete require.cache[require.resolve("../src/utils/sendEmail")];

  // Inject the stub BEFORE require.
  const sendEmailMod = {
    exports: sendEmailStub,
  };
  require.cache[require.resolve("../src/utils/sendEmail")] = {
    id: require.resolve("../src/utils/sendEmail"),
    filename: require.resolve("../src/utils/sendEmail"),
    loaded: true,
    exports: sendEmailStub,
  };

  const app = express();
  app.use(express.json());
  app.use("/api/vendors", require("../src/routes/vendors"));

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

async function connectMongo() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function seedAdmin() {
  adminUser = await User.create({
    email: "admin@test.com",
    passwordHash: "x",
    name: "Admin",
    role: "admin",
  });
  adminToken = jwt.sign(
    { id: adminUser._id.toString(), role: "admin" },
    process.env.JWT_SECRET,
  );
}

async function seedApplication(overrides = {}) {
  return VendorApplication.create({
    studioName: "Test Studio",
    email: "test@example.com",
    websiteOrPortfolio: "https://example.com",
    status: "pending",
    ...overrides,
  });
}

async function teardown() {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

async function run() {
  console.log("\nPhase 1C — vendor approval atomicity\n");

  await connectMongo();
  await seedAdmin();

  // ---- Test 1: email failure → 502, DB unchanged ----
  const app1 = await VendorApplication.create({
    studioName: "Failing Email Studio",
    email: "fail@example.com",
    websiteOrPortfolio: "https://example.com",
    status: "pending",
  });
  await startServer(async () => {
    const err = new Error("SMTP ECONNECTION refused");
    err.code = "ECONNECTION";
    throw err;
  });

  const r1 = await fetch(
    `${baseUrl}/api/vendors/applications/${app1._id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    },
  );
  const b1 = await r1.json();
  check("email failure → 502 (Bad Gateway)", r1.status === 502);
  check(
    "502 message mentions SMTP / no state change",
    /SMTP|state|not been changed/i.test(b1.message || ""),
  );

  const reread1 = await VendorApplication.findById(app1._id);
  check("DB state unchanged after email failure (still pending)", reread1.status === "pending");
  check("reviewedBy NOT set after email failure", reread1.reviewedBy == null);

  await teardown();

  // ---- Test 2: success path → 200, DB committed ----
  await connectMongo();
  await seedAdmin();

  const app2 = await VendorApplication.create({
    studioName: "Working Email Studio",
    email: "ok@example.com",
    websiteOrPortfolio: "https://example.com",
    status: "pending",
  });
  await startServer(async () => ({ messageId: "stub" }));

  const r2 = await fetch(
    `${baseUrl}/api/vendors/applications/${app2._id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    },
  );
  const b2 = await r2.json();
  check("success path → 200", r2.status === 200);
  check("response message confirms approval", /approved successfully/.test(b2.message || ""));

  const reread2 = await VendorApplication.findById(app2._id);
  check("DB state committed to 'approved'", reread2.status === "approved");
  check("reviewedBy is set", reread2.reviewedBy != null);
  check("reviewedAt is set", reread2.reviewedAt != null);

  // ---- Test 3: idempotency — second approval is a no-op ----
  const reviewedAtBefore = reread2.reviewedAt;
  const r3 = await fetch(
    `${baseUrl}/api/vendors/applications/${app2._id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "approved" }),
    },
  );
  const b3 = await r3.json();
  check("second approval is idempotent (200)", r3.status === 200);
  check(
    "second approval message says 'already'",
    /already/i.test(b3.message || ""),
  );
  const reread3 = await VendorApplication.findById(app2._id);
  check(
    "reviewedAt unchanged on idempotent call",
    reread3.reviewedAt.getTime() === reviewedAtBefore.getTime(),
  );

  await teardown();

  console.log(`\n  ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
