require('dotenv').config();
const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const GoogleRegistrationDraft = require('../src/models/GoogleRegistrationDraft');
const User = require('../src/models/User');
const Vendor = require('../src/models/Vendor');
const VendorApplication = require('../src/models/VendorApplication');
const { consumeDraftAndCreateApplication } = require('../src/routes/googleAuth');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);

  const marker = crypto.randomBytes(8).toString('hex');
  const draftId = `qa-${marker}`;
  const email = `qa-google-${marker}@example.com`;
  const googleId = `qa-google-subject-${marker}`;

  try {
    await GoogleRegistrationDraft.create({
      draftId,
      studioName: 'Google Draft Integration QA',
      websiteOrPortfolio: 'https://example.com/google-draft-qa',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const first = await consumeDraftAndCreateApplication(draftId, { email, googleId });
    assert.deepStrictEqual(first, { ok: true });

    const application = await VendorApplication.findOne({ verifiedGoogleId: googleId }).lean();
    assert.ok(application, 'pending application was not created');
    assert.strictEqual(application.email, email);
    assert.strictEqual(application.verifiedGoogleEmail, email);
    assert.strictEqual(application.status, 'pending');
    assert.strictEqual(application.studioName, 'Google Draft Integration QA');
    assert.strictEqual(application.websiteOrPortfolio, 'https://example.com/google-draft-qa');

    assert.strictEqual(await User.exists({ email }), null, 'pre-approval User was created');
    assert.strictEqual(await Vendor.exists({ email }), null, 'pre-approval Vendor was created');

    const replay = await consumeDraftAndCreateApplication(draftId, { email, googleId });
    assert.strictEqual(replay.ok, false);
    assert.strictEqual(replay.error, 'draft_unavailable');

    console.log('PASS atomic draft consumption, waitlist-only application, and replay denial');
  } finally {
    await Promise.all([
      GoogleRegistrationDraft.deleteMany({ draftId }),
      VendorApplication.deleteMany({
        $or: [{ email }, { verifiedGoogleEmail: email }, { verifiedGoogleId: googleId }],
      }),
      User.deleteMany({ $or: [{ email }, { googleId }] }),
      Vendor.deleteMany({ email }),
    ]);
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
