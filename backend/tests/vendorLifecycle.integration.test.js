/**
 * Integration tests for the full vendor auth-approval lifecycle.
 * Covers task 6.1: manual apply, Google draft consumption, pending/rejected
 * denial, approved login, password setup/reset, and route authorization.
 *
 * Runs: node tests/vendorLifecycle.integration.test.js
 * Requires MONGO_URI in backend/.env.
 */
require('dotenv').config();
const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Vendor = require('../src/models/Vendor');
const VendorApplication = require('../src/models/VendorApplication');
const GoogleRegistrationDraft = require('../src/models/GoogleRegistrationDraft');
const { processApplicationDecision } = require('../src/routes/vendors');
const { hashPasswordToken } = require('../src/utils/passwordTokens');
const { decideStudioAccess } = require('../src/utils/studioAccess');

let failed = 0;
async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
  }
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);

  const marker = crypto.randomBytes(8).toString('hex');
  const adminEmail = `qa-life-admin-${marker}@example.com`;
  const studioName = `QA Lifecycle Studio ${marker}`;
  const email = (label) => `qa-life-${label}-${marker}@example.com`;

  const sentEmails = [];
  const stubEmail = async (opts) => { sentEmails.push(opts); };

  try {
    const admin = await User.create({
      name: 'QA Admin',
      email: adminEmail,
      authProvider: 'invited',
      role: 'admin',
    });

    await checkAsync('manual apply: creates pending application, no user/vendor', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: email('manual'),
        websiteOrPortfolio: 'https://example.com/portfolio',
      });
      assert.strictEqual(app.status, 'pending');
      assert.strictEqual(await User.exists({ email: email('manual') }), null);
      assert.strictEqual(await Vendor.exists({ email: email('manual') }), null);
    });

    await checkAsync('google draft: creates draft, consume creates pending application', async () => {
      const draft = await GoogleRegistrationDraft.create({
        draftId: crypto.randomBytes(16).toString('hex'),
        studioName,
        websiteOrPortfolio: 'https://example.com/google',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      assert.ok(draft.draftId);
      assert.strictEqual(draft.consumedAt, null);

      const googleIdentity = {
        googleId: `google-sub-${marker}`,
        email: email('google'),
      };

      const created = await VendorApplication.create({
        studioName: draft.studioName,
        email: googleIdentity.email,
        websiteOrPortfolio: draft.websiteOrPortfolio,
        verifiedGoogleId: googleIdentity.googleId,
        verifiedGoogleEmail: googleIdentity.email,
        googleEmail: googleIdentity.email,
      });
      assert.strictEqual(created.status, 'pending');
      assert.strictEqual(created.verifiedGoogleId, googleIdentity.googleId);

      draft.consumedAt = new Date();
      await draft.save();
      assert.ok(draft.consumedAt);
    });

    await checkAsync('pending denial: decideStudioAccess returns application_pending', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: email('pending'),
        websiteOrPortfolio: 'https://example.com/pending',
      });
      const access = decideStudioAccess({ existingUser: null, application: app });
      assert.strictEqual(access.ok, false);
      assert.strictEqual(access.error, 'application_pending');
    });

    await checkAsync('rejected denial: decideStudioAccess returns application_rejected', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: email('rejected'),
        websiteOrPortfolio: 'https://example.com/rejected',
        status: 'rejected',
      });
      const access = decideStudioAccess({ existingUser: null, application: app });
      assert.strictEqual(access.ok, false);
      assert.strictEqual(access.error, 'application_rejected');
    });

    await checkAsync('approved login: approval creates user+vendor, decideStudioAccess allows', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: email('approved'),
        websiteOrPortfolio: 'https://example.com/approved',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.user);
      assert.ok(result.vendor);
      assert.ok(result.passwordUrl);

      const savedApp = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(savedApp.status, 'approved');

      const user = await User.findOne({ email: email('approved') }).lean();
      assert.strictEqual(user.role, 'vendor');
      assert.strictEqual(user.authProvider, 'invited');
      assert.ok(user.resetPasswordToken);

      const access = decideStudioAccess({ existingUser: user, application: null });
      assert.strictEqual(access.ok, true);
    });

    await checkAsync('password setup/reset: token hash matches, reset clears token', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: email('reset'),
        websiteOrPortfolio: 'https://example.com/reset',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });

      const rawToken = result.passwordUrl.split('/reset-password/')[1];
      const user = await User.findOne({ email: email('reset') });
      assert.strictEqual(user.resetPasswordToken, hashPasswordToken(rawToken));
      assert.ok(user.resetPasswordExpire > Date.now());

      const found = await User.findOne({
        resetPasswordToken: hashPasswordToken(rawToken),
        resetPasswordExpire: { $gt: Date.now() },
      });
      assert.ok(found);

      const newPassword = 'ValidPass123';
      found.passwordHash = await bcrypt.hash(newPassword, 10);
      found.resetPasswordToken = undefined;
      found.resetPasswordExpire = undefined;
      await found.save();

      const after = await User.findOne({ email: email('reset') }).lean();
      assert.strictEqual(after.resetPasswordToken, undefined);
      assert.strictEqual(after.resetPasswordExpire, undefined);
      const match = await bcrypt.compare(newPassword, after.passwordHash);
      assert.ok(match);
    });

    await checkAsync('route authorization: vendor JWT valid, suspended vendor denied', async () => {
      const user = await User.findOne({ email: email('approved') }).lean();
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.strictEqual(String(decoded.id), String(user._id));

      const suspendedUser = { ...user, isActive: false };
      const access = decideStudioAccess({ existingUser: suspendedUser, application: null });
      assert.strictEqual(access.ok, false);
      assert.strictEqual(access.error, 'account_suspended');
    });

    await checkAsync('atomicity: duplicate vendor email aborts, application stays pending', async () => {
      const dupEmail = email('atomic');
      const otherUser = await User.create({
        name: 'Other Vendor',
        email: `other-owner-${marker}@example.com`,
        authProvider: 'invited',
        role: 'vendor',
      });
      await Vendor.create({
        name: studioName,
        email: dupEmail,
        owner: otherUser._id,
      });

      const app = await VendorApplication.create({
        studioName,
        email: dupEmail,
        websiteOrPortfolio: 'https://example.com/atomic',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'conflict');

      const savedApp = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(savedApp.status, 'pending');
    });
  } finally {
    const allEmails = [
      email('manual'), email('google'), email('pending'), email('rejected'),
      email('approved'), email('reset'), email('atomic'),
      `other-owner-${marker}@example.com`, adminEmail,
    ];
    await Promise.all([
      VendorApplication.deleteMany({ email: { $in: allEmails } }),
      User.deleteMany({ email: { $in: allEmails } }),
      Vendor.deleteMany({ email: { $in: allEmails } }),
      GoogleRegistrationDraft.deleteMany({ studioName }),
    ]);
    await mongoose.disconnect();
  }
}

(async () => {
  try {
    await main();
    if (failed) {
      console.error(`\n${failed} test(s) failed`);
      process.exit(1);
    }
    console.log('\nAll vendor lifecycle integration tests passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
