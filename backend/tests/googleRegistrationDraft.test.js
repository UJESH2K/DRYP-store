/**
 * Unit tests for Google vendor registration draft and OAuth callback hardening.
 * Runs: node tests/googleRegistrationDraft.test.js
 */
const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  buildOAuthStatePayload,
  buildRedirect,
  buildFrontendRedirect,
  buildRegisterStatusRedirect,
} = require('../src/routes/googleAuth');
const { normalizeEmail, decideStudioAccess } = require('../src/utils/studioAccess');
const GoogleRegistrationDraft = require('../src/models/GoogleRegistrationDraft');
const VendorApplication = require('../src/models/VendorApplication');

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

// Mock models for unit tests
const createMockModels = (overrides = {}) => {
  const store = {
    users: overrides.users || [],
    apps: overrides.apps || [],
    drafts: overrides.drafts || [],
  };

  return {
    User: {
      findOne: async (query) => {
        if (query.$or) {
          return store.users.find(u => query.$or.some(clause =>
            (clause.email && u.email === clause.email) ||
            (clause.googleId && u.googleId === clause.googleId)
          )) || null;
        }
        if (query.email) return store.users.find(u => u.email === query.email) || null;
        if (query.googleId) return store.users.find(u => u.googleId === query.googleId) || null;
        return null;
      },
      create: async (data) => {
        const user = { _id: crypto.randomBytes(12).toString('hex'), ...data };
        store.users.push(user);
        return user;
      },
    },
    VendorApplication: {
      findOne: async (query) => {
        if (query.$or) {
          return store.apps.find(a => query.$or.some(clause =>
            (clause.email && a.email === clause.email) ||
            (clause.googleEmail && a.googleEmail === clause.googleEmail) ||
            (clause.verifiedGoogleEmail && a.verifiedGoogleEmail === clause.verifiedGoogleEmail) ||
            (clause.verifiedGoogleId && a.verifiedGoogleId === clause.verifiedGoogleId)
          )) || null;
        }
        if (query.email) return store.apps.find(a => a.email === query.email) || null;
        if (query.verifiedGoogleEmail) return store.apps.find(a => a.verifiedGoogleEmail === query.verifiedGoogleEmail) || null;
        if (query.verifiedGoogleId) return store.apps.find(a => a.verifiedGoogleId === query.verifiedGoogleId) || null;
        return null;
      },
      create: async (data) => {
        const app = { _id: crypto.randomBytes(12).toString('hex'), ...data, createdAt: new Date(), updatedAt: new Date() };
        store.apps.push(app);
        return app;
      },
    },
    GoogleRegistrationDraft: {
      findOne: async (query) => {
        if (query.draftId) return store.drafts.find(d => d.draftId === query.draftId) || null;
        return null;
      },
      findOneAndUpdate: async (filter, update) => {
        const idx = store.drafts.findIndex(d => d.draftId === filter.draftId);
        if (idx === -1) return null;
        store.drafts[idx] = { ...store.drafts[idx], ...update.$set };
        return store.drafts[idx];
      },
      create: async (data) => {
        const draft = { ...data, createdAt: new Date(), updatedAt: new Date() };
        store.drafts.push(draft);
        return draft;
      },
    },
    Vendor: {
      findOne: async (query) => {
        if (query.owner) return store.vendors?.find(v => v.owner === query.owner) || null;
        return null;
      },
      create: async (data) => {
        const vendor = { _id: crypto.randomBytes(12).toString('hex'), ...data };
        store.vendors = store.vendors || [];
        store.vendors.push(vendor);
        return vendor;
      },
    },
  };
};

check('buildOAuthStatePayload includes draftId for register intent', () => {
  const state = buildOAuthStatePayload({
    guestId: 'guest123',
    platform: 'web',
    intent: 'register',
    draftId: 'draft_abc123',
  });
  assert.strictEqual(state.intent, 'register');
  assert.strictEqual(state.draftId, 'draft_abc123');
  assert.strictEqual(state.platform, 'web');
  assert.strictEqual(state.guestId, 'guest123');
});

check('buildOAuthStatePayload omits draftId for login intent', () => {
  const state = buildOAuthStatePayload({
    guestId: null,
    platform: 'web',
    intent: 'login',
  });
  assert.strictEqual(state.intent, 'login');
  assert.strictEqual(state.draftId, null);
});

check('normalizeEmail lowercases and trims', () => {
  assert.strictEqual(normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
});

check('decideStudioAccess: no application → no_application', () => {
  const r = decideStudioAccess({ existingUser: null, application: null });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'no_application');
});

check('decideStudioAccess: pending → application_pending', () => {
  const r = decideStudioAccess({ existingUser: null, application: { status: 'pending' } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'application_pending');
});

check('decideStudioAccess: rejected → application_rejected', () => {
  const r = decideStudioAccess({ existingUser: null, application: { status: 'rejected' } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'application_rejected');
});

check('decideStudioAccess: approved first-time → ok', () => {
  const app = { status: 'approved', studioName: 'Acme' };
  const r = decideStudioAccess({ existingUser: null, application: app });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.application, app);
});

check('decideStudioAccess: active vendor returns ok without application', () => {
  const user = { role: 'vendor', isActive: true, email: 'v@x.com' };
  const r = decideStudioAccess({ existingUser: user, application: null });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.existingUser.role, 'vendor');
});

check('decideStudioAccess: suspended vendor denied', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'vendor', isActive: false },
    application: { status: 'approved' },
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'account_suspended');
});

check('decideStudioAccess: shopper with approved app allowed', () => {
  const r = decideStudioAccess({
    existingUser: { role: 'user', isActive: true },
    application: { status: 'approved' },
  });
  assert.strictEqual(r.ok, true);
});

// GoogleRegistrationDraft model tests
check('GoogleRegistrationDraft model has required fields', () => {
  const schema = GoogleRegistrationDraft.schema;
  assert.ok(schema.path('draftId'));
  assert.ok(schema.path('studioName'));
  assert.ok(schema.path('websiteOrPortfolio'));
  assert.ok(schema.path('expiresAt'));
  assert.ok(schema.path('consumedAt'));
});

check('GoogleRegistrationDraft has TTL index on expiresAt', () => {
  const indexes = GoogleRegistrationDraft.schema.indexes();
  const ttlIndex = indexes.find(idx => idx[0].expiresAt && idx[1]?.expireAfterSeconds === 0);
  assert.ok(ttlIndex, 'TTL index on expiresAt with expireAfterSeconds: 0 not found');
});

check('GoogleRegistrationDraft draftId is unique', () => {
  const schema = GoogleRegistrationDraft.schema;
  const draftIdPath = schema.path('draftId');
  assert.strictEqual(draftIdPath.options.unique, true);
});

check('VendorApplication verified Google identities use partial unique indexes', () => {
  const indexes = VendorApplication.schema.indexes();
  for (const field of ['verifiedGoogleEmail', 'verifiedGoogleId']) {
    const index = indexes.find(([keys]) => keys[field] === 1);
    assert.ok(index, `missing ${field} index`);
    assert.strictEqual(index[1].unique, true);
    assert.deepStrictEqual(index[1].partialFilterExpression, {
      [field]: { $type: 'string' },
    });
  }
});

// Integration-style tests with mock models
async function runIntegrationTests() {
  const models = createMockModels();

  await checkAsync('GoogleRegistrationDraft: create draft with valid data', async () => {
    const draft = await models.GoogleRegistrationDraft.create({
      draftId: 'test_draft_1',
      studioName: 'Test Studio',
      websiteOrPortfolio: 'https://example.com/portfolio',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    assert.strictEqual(draft.draftId, 'test_draft_1');
    assert.strictEqual(draft.studioName, 'Test Studio');
    assert.strictEqual(draft.websiteOrPortfolio, 'https://example.com/portfolio');
    assert.ok(draft.consumedAt === null || draft.consumedAt === undefined);
  });

  await checkAsync('GoogleRegistrationDraft: find draft by draftId', async () => {
    const draft = await models.GoogleRegistrationDraft.findOne({ draftId: 'test_draft_1' });
    assert.ok(draft);
    assert.strictEqual(draft.studioName, 'Test Studio');
  });

  await checkAsync('GoogleRegistrationDraft: consume draft marks consumedAt', async () => {
    const updated = await models.GoogleRegistrationDraft.findOneAndUpdate(
      { draftId: 'test_draft_1' },
      { $set: { consumedAt: new Date() } }
    );
    assert.ok(updated);
    assert.ok(updated.consumedAt);
  });

  await checkAsync('VendorApplication: create with verifiedGoogleEmail and verifiedGoogleId', async () => {
    const app = await models.VendorApplication.create({
      studioName: 'Google Studio',
      email: 'contact@studio.com',
      websiteOrPortfolio: 'https://studio.com',
      verifiedGoogleEmail: 'owner@gmail.com',
      verifiedGoogleId: 'google_sub_12345',
      status: 'pending',
    });
    assert.strictEqual(app.verifiedGoogleEmail, 'owner@gmail.com');
    assert.strictEqual(app.verifiedGoogleId, 'google_sub_12345');
    assert.strictEqual(app.status, 'pending');
  });

  await checkAsync('VendorApplication: find by verifiedGoogleEmail', async () => {
    const app = await models.VendorApplication.findOne({ verifiedGoogleEmail: 'owner@gmail.com' });
    assert.ok(app);
    assert.strictEqual(app.studioName, 'Google Studio');
  });

  await checkAsync('VendorApplication: find by verifiedGoogleId', async () => {
    const app = await models.VendorApplication.findOne({ verifiedGoogleId: 'google_sub_12345' });
    assert.ok(app);
    assert.strictEqual(app.studioName, 'Google Studio');
  });

  await checkAsync('VendorApplication: verified identity fields remain optional', async () => {
    const app = await models.VendorApplication.create({
      studioName: 'No Google Studio',
      email: 'contact2@studio.com',
      websiteOrPortfolio: 'https://studio2.com',
      status: 'pending',
    });
    assert.strictEqual(app.verifiedGoogleEmail, undefined);
    assert.strictEqual(app.verifiedGoogleId, undefined);
  });
}

async function runOAuthStateTests() {
  const JWT_SECRET = 'test_secret';

  await checkAsync('OAuth state: register intent with draftId encodes correctly', async () => {
    const payload = buildOAuthStatePayload({
      guestId: 'guest1',
      platform: 'web',
      intent: 'register',
      draftId: 'draft_xyz',
    });
    const state = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
    const decoded = jwt.verify(state, JWT_SECRET);
    assert.strictEqual(decoded.intent, 'register');
    assert.strictEqual(decoded.draftId, 'draft_xyz');
    assert.strictEqual(decoded.platform, 'web');
    assert.strictEqual(decoded.guestId, 'guest1');
  });

  await checkAsync('OAuth state: login intent without draftId encodes correctly', async () => {
    const payload = buildOAuthStatePayload({
      guestId: null,
      platform: 'web',
      intent: 'login',
    });
    const state = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
    const decoded = jwt.verify(state, JWT_SECRET);
    assert.strictEqual(decoded.intent, 'login');
    assert.strictEqual(decoded.draftId, null);
  });

  await checkAsync('buildRedirect: web platform uses frontend redirect', async () => {
    const url = buildRedirect('web', { token: 'abc123' });
    assert.ok(url.startsWith('http://localhost:3000/oauth/google/callback?'));
    assert.ok(url.includes('token=abc123'));
  });

  await checkAsync('buildRedirect: mobile platform uses deep link', async () => {
    const url = buildRedirect('mobile', { token: 'abc123' });
    assert.ok(url.startsWith('dryp://oauth-callback?'));
    assert.ok(url.includes('token=abc123'));
  });

  await checkAsync('buildRegisterStatusRedirect: creates correct URL with status', async () => {
    const url = buildRegisterStatusRedirect('application_pending');
    assert.ok(url.includes('status=application_pending'));
    assert.ok(!url.includes('email='));
    assert.ok(!url.includes('name='));
  });
}

(async () => {
  await runIntegrationTests();
  await runOAuthStateTests();
  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll GoogleRegistrationDraft tests passed');
})();
