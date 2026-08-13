/**
 * Integration tests for the vendor application approve/reject flow.
 * Runs: node tests/vendorApproval.integration.test.js
 * Requires MONGO_URI in backend/.env. Email delivery is stubbed.
 */
require('dotenv').config();
const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Vendor = require('../src/models/Vendor');
const VendorApplication = require('../src/models/VendorApplication');
const { processApplicationDecision } = require('../src/routes/vendors');
const { hashPasswordToken } = require('../src/utils/passwordTokens');

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
  const adminEmail = `qa-admin-${marker}@example.com`;
  const emails = {
    approve: `qa-approve-${marker}@example.com`,
    reject: `qa-reject-${marker}@example.com`,
    upgrade: `qa-upgrade-${marker}@example.com`,
    noDup: `qa-nodup-${marker}@example.com`,
    invalid: `qa-invalid-${marker}@example.com`,
    conflict: `qa-conflict-${marker}@example.com`,
    otherOwner: `qa-otherowner-${marker}@example.com`,
  };
  const studioName = `QA Studio ${marker}`;

  const sent = [];
  const stubEmail = async (opts) => {
    sent.push(opts);
  };

  try {
    const admin = await User.create({
      name: 'QA Admin',
      email: adminEmail,
      authProvider: 'invited',
      role: 'admin',
    });

    await checkAsync('approve: creates invited vendor user + vendor, stores reviewedBy, emails password URL', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: emails.approve,
        websiteOrPortfolio: 'https://example.com/qa',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.strictEqual(result.ok, true);

      const saved = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(saved.status, 'approved');
      assert.strictEqual(String(saved.reviewedBy), String(admin._id));
      assert.ok(saved.reviewedAt instanceof Date);

      const user = await User.findOne({ email: emails.approve }).lean();
      assert.ok(user, 'invited user created');
      assert.strictEqual(user.authProvider, 'invited');
      assert.strictEqual(user.role, 'vendor');
      assert.ok(user.resetPasswordToken, 'reset token hash stored');
      assert.ok(user.resetPasswordExpire > Date.now());

      const rawToken = result.passwordUrl.split('/reset-password/')[1];
      assert.strictEqual(user.resetPasswordToken, hashPasswordToken(rawToken));

      const vendor = await Vendor.findOne({ owner: user._id }).lean();
      assert.ok(vendor, 'vendor created');
      assert.strictEqual(vendor.email, emails.approve);

      const mail = sent[sent.length - 1];
      assert.strictEqual(mail.subject, 'DRYP: Studio Approved');
      assert.strictEqual(mail.email, emails.approve);
      assert.ok(mail.message.includes(`/reset-password/${rawToken}`));
    });

    await checkAsync('reject: marks rejected, sends rejection email, creates no user/vendor', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: emails.reject,
        websiteOrPortfolio: 'https://example.com/qa',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'rejected',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.strictEqual(result.ok, true);

      const saved = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(saved.status, 'rejected');
      assert.strictEqual(String(saved.reviewedBy), String(admin._id));

      assert.strictEqual(await User.exists({ email: emails.reject }), null);
      assert.strictEqual(await Vendor.exists({ email: emails.reject }), null);

      const mail = sent[sent.length - 1];
      assert.strictEqual(mail.subject, 'DRYP: Application Status');
      assert.strictEqual(mail.email, emails.reject);
    });

    await checkAsync('approve: upgrades existing shopper to vendor and sets reset token', async () => {
      await User.create({
        name: 'QA Shopper',
        email: emails.upgrade,
        authProvider: 'invited',
        role: 'user',
      });
      const app = await VendorApplication.create({
        studioName,
        email: emails.upgrade,
        websiteOrPortfolio: 'https://example.com/qa',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.strictEqual(result.ok, true);

      const user = await User.findOne({ email: emails.upgrade }).lean();
      assert.strictEqual(user.role, 'vendor');
      assert.ok(user.resetPasswordToken);
      const vendor = await Vendor.findOne({ owner: user._id }).lean();
      assert.ok(vendor, 'vendor created for upgraded shopper');
    });

    await checkAsync('approve: does not duplicate an existing vendor', async () => {
      const user = await User.create({
        name: 'QA Vendor',
        email: emails.noDup,
        authProvider: 'invited',
        role: 'vendor',
      });
      await Vendor.create({ name: studioName, email: emails.noDup, owner: user._id });
      const app = await VendorApplication.create({
        studioName,
        email: emails.noDup,
        websiteOrPortfolio: 'https://example.com/qa',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.strictEqual(result.ok, true);

      assert.strictEqual(await Vendor.countDocuments({ owner: user._id }), 1);
    });

    await checkAsync('invalid status: returns invalid_status without side effects', async () => {
      const app = await VendorApplication.create({
        studioName,
        email: emails.invalid,
        websiteOrPortfolio: 'https://example.com/qa',
      });

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'maybe',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.deepStrictEqual(result, { ok: false, error: 'invalid_status' });

      const saved = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(saved.status, 'pending');
    });

    await checkAsync('approve: duplicate Vendor email aborts the transaction (app stays pending, no invited user, no email)', async () => {
      const other = await User.create({
        name: 'QA Other Owner',
        email: emails.otherOwner,
        authProvider: 'invited',
        role: 'vendor',
      });
      await Vendor.create({
        name: 'Conflicting Studio',
        email: emails.conflict,
        owner: other._id,
      });
      const app = await VendorApplication.create({
        studioName,
        email: emails.conflict,
        websiteOrPortfolio: 'https://example.com/qa',
      });
      const sentBefore = sent.length;

      const result = await processApplicationDecision({
        applicationId: app._id,
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });

      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, 'conflict');

      const saved = await VendorApplication.findById(app._id).lean();
      assert.strictEqual(saved.status, 'pending', 'application must roll back to pending');
      assert.strictEqual(saved.reviewedBy, undefined, 'reviewedBy must not survive a rollback');
      assert.strictEqual(saved.reviewedAt, undefined, 'reviewedAt must not survive a rollback');
      assert.strictEqual(
        await User.exists({ email: emails.conflict }),
        null,
        'invited user must be rolled back',
      );
      assert.strictEqual(sent.length, sentBefore, 'no email may be sent for an aborted decision');
    });

    await checkAsync('missing application: returns not_found', async () => {
      const result = await processApplicationDecision({
        applicationId: new mongoose.Types.ObjectId(),
        status: 'approved',
        adminId: admin._id,
        sendEmailFn: stubEmail,
      });
      assert.deepStrictEqual(result, { ok: false, error: 'not_found' });
    });
  } finally {
    const allEmails = [...Object.values(emails), adminEmail];
    await Promise.all([
      VendorApplication.deleteMany({ email: { $in: allEmails } }),
      User.deleteMany({ email: { $in: allEmails } }),
      Vendor.deleteMany({ email: { $in: allEmails } }),
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
    console.log('\nAll vendor approval integration tests passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
