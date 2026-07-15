/**
 * Unit tests for the shipped studio Google access gate.
 * Runs: node tests/studioAccess.test.js
 */
const assert = require('assert');
const {
  decideStudioAccess,
  normalizeEmail,
  assertStudioAccessAllowed,
} = require('../src/utils/studioAccess');
const { buildOAuthStatePayload } = require('../src/routes/googleAuth');
const {
  createPasswordToken,
  hashPasswordToken,
} = require('../src/utils/passwordTokens');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message}`);
  }
}

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

check('normalizeEmail lowercases and trims', () => {
  assert.strictEqual(normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
});

check('register OAuth state preserves register intent', () => {
  const state = buildOAuthStatePayload({
    guestId: null,
    platform: 'web',
    intent: 'register',
  });
  assert.strictEqual(state.intent, 'register');
});

check('password claim token stores only a hash with an expiry', () => {
  const issued = createPasswordToken(60_000);
  assert.ok(issued.rawToken);
  assert.notStrictEqual(issued.rawToken, issued.hashedToken);
  assert.strictEqual(hashPasswordToken(issued.rawToken), issued.hashedToken);
  assert.ok(issued.expiresAt > Date.now());
});

check('no application → no_application', () => {
  const r = decideStudioAccess({ existingUser: null, application: null });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'no_application');
});

check('pending → application_pending', () => {
  const r = decideStudioAccess({
    existingUser: null,
    application: { status: 'pending', email: 'a@b.com' },
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'application_pending');
});

check('rejected → application_rejected', () => {
  const r = decideStudioAccess({
    existingUser: null,
    application: { status: 'rejected' },
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'application_rejected');
});

check('approved first-time → ok, no JWT side effects (pure)', () => {
  const app = { status: 'approved', studioName: 'Acme' };
  const r = decideStudioAccess({ existingUser: null, application: app });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.application, app);
  assert.strictEqual(r.existingUser, null);
});

check('active vendor returns ok without application', () => {
  const user = { role: 'vendor', isActive: true, email: 'v@x.com' };
  const r = decideStudioAccess({ existingUser: user, application: null });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.existingUser.role, 'vendor');
});

check('active admin returns ok', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'admin', isActive: true },
    application: null,
  });
  assert.strictEqual(r.ok, true);
});

check('suspended vendor denied', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'vendor', isActive: false },
    application: { status: 'approved' },
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'account_suspended');
});

check('shopper role without approved app denied (no silent escalate)', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'user', isActive: true },
    application: null,
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'no_application');
});

check('shopper with approved app allowed (promote later)', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'user', isActive: true },
    application: { status: 'approved' },
  });
  assert.strictEqual(r.ok, true);
});

async function runDbGateTests() {
  const store = {
    users: [
      { email: 'vendor@dryp.test', role: 'vendor', isActive: true },
      { email: 'user@dryp.test', role: 'user', isActive: true },
    ],
    apps: [
      { email: 'pending@dryp.test', status: 'pending' },
      { email: 'ok@dryp.test', status: 'approved', studioName: 'OK Studio' },
      {
        email: 'brand@studio.com',
        googleEmail: 'sxvocusa@gmail.com',
        status: 'approved',
        studioName: 'Linked Studio',
      },
      {
        email: 'verified@studio.com',
        verifiedGoogleEmail: 'verified@gmail.com',
        verifiedGoogleId: 'google-subject-1',
        status: 'approved',
        studioName: 'Verified Studio',
      },
    ],
  };

  const models = {
    User: {
      findOne: async (query) => {
        const clauses = query.$or || [query];
        return store.users.find((user) =>
          clauses.some((clause) =>
            (clause.email && user.email === clause.email) ||
            (clause.googleId && user.googleId === clause.googleId),
          ),
        ) || null;
      },
    },
    VendorApplication: {
      findOne: async (query) => {
        if (query.$or) {
          return (
            store.apps.find((a) =>
              query.$or.some(
                (clause) =>
                  (clause.email && a.email === clause.email) ||
                  (clause.googleEmail && a.googleEmail === clause.googleEmail) ||
                  (clause.verifiedGoogleEmail &&
                    a.verifiedGoogleEmail === clause.verifiedGoogleEmail) ||
                  (clause.verifiedGoogleId && a.verifiedGoogleId === clause.verifiedGoogleId),
              ),
            ) || null
          );
        }
        if (query.email) {
          return store.apps.find((a) => a.email === query.email) || null;
        }
        return null;
      },
    },
  };

  await checkAsync('assertStudioAccessAllowed: unknown email', async () => {
    const r = await assertStudioAccessAllowed('nobody@dryp.test', models);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'no_application');
  });

  await checkAsync('assertStudioAccessAllowed: pending', async () => {
    const r = await assertStudioAccessAllowed('pending@dryp.test', models);
    assert.strictEqual(r.error, 'application_pending');
  });

  await checkAsync('assertStudioAccessAllowed: approved contact email', async () => {
    const r = await assertStudioAccessAllowed('ok@dryp.test', models);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.application.studioName, 'OK Studio');
  });

  await checkAsync('assertStudioAccessAllowed: linked googleEmail', async () => {
    const r = await assertStudioAccessAllowed('sxvocusa@gmail.com', models);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.application.studioName, 'Linked Studio');
    assert.strictEqual(r.application.email, 'brand@studio.com');
  });

  await checkAsync('assertStudioAccessAllowed: contact email still works when googleEmail set', async () => {
    const r = await assertStudioAccessAllowed('brand@studio.com', models);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.application.studioName, 'Linked Studio');
  });

  await checkAsync('assertStudioAccessAllowed: verified Google email', async () => {
    const r = await assertStudioAccessAllowed('verified@gmail.com', models);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.application.studioName, 'Verified Studio');
  });

  await checkAsync('assertStudioAccessAllowed: verified Google subject', async () => {
    const r = await assertStudioAccessAllowed('changed@gmail.com', models, 'google-subject-1');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.application.studioName, 'Verified Studio');
  });

  await checkAsync('assertStudioAccessAllowed: existing vendor', async () => {
    const r = await assertStudioAccessAllowed('vendor@dryp.test', models);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.existingUser.role, 'vendor');
  });

  await checkAsync('assertStudioAccessAllowed: shopper no app', async () => {
    const r = await assertStudioAccessAllowed('user@dryp.test', models);
    assert.strictEqual(r.ok, false);
  });
}

(async () => {
  await runDbGateTests();
  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll studioAccess tests passed');
})();
