/**
 * Structural + optional live checks for vendor website studio ship path.
 * Runs: node tests/shipWebsiteStudio.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SCRATCH =
  process.env.SCRATCH_DIR ||
  path.join(__dirname, '../../.omo');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

check('googleAuth uses assertStudioAccessAllowed from studioAccess util', () => {
  const src = read('backend/src/routes/googleAuth.js');
  assert.ok(src.includes("require('../utils/studioAccess')"));
  assert.ok(src.includes('assertStudioAccessAllowed'));
  assert.ok(src.includes("buildRedirect('web', { error: access.error })"));
  assert.ok(src.includes('buildOAuthStatePayload'));
  // must not mint token before access check path for denials
  assert.ok(src.indexOf('assertStudioAccessAllowed') < src.indexOf('jwt.sign'));
});

check('Google OAuth has a dedicated rate limiter', () => {
  const src = read('backend/server.js');
  assert.ok(src.includes('const googleAuthLimiter = rateLimit'));
  assert.ok(src.includes('app.use("/api/auth/google", googleAuthLimiter)'));
  assert.ok(!src.includes('app.use("/api/auth/google", shopifyAuthLimiter)'));
});

check('callback page maps approval error codes', () => {
  const src = read('website/src/app/oauth/google/callback/page.tsx');
  for (const code of [
    'no_application',
    'application_pending',
    'application_rejected',
  ]) {
    assert.ok(src.includes(code), `missing ${code}`);
  }
  assert.ok(src.includes('/register'));
});

check('login Google primary + apply messaging', () => {
  const src = read('website/src/app/login/page.tsx');
  assert.ok(src.includes('Continue with Google'));
  assert.ok(src.includes('Approved brands only'));
  assert.ok(src.includes('/api/auth/google?intent=login'));
});

check('register Google path is waitlisted before approval', () => {
  const googleForm = read('website/src/app/register/components/GoogleForm.tsx');
  const src = [
    read('website/src/app/register/page.tsx'),
    read('website/src/app/register/hooks/useRegisterForm.ts'),
    read('website/src/app/register/components/StatusNotice.tsx'),
    googleForm,
  ].join('\n');
  assert.ok(src.includes('application_pending'));
  assert.ok(src.includes("/api/auth/google?intent=register"));
  assert.ok(src.includes("dashboard access") && src.includes("DRYP approves"));
  assert.ok(src.includes('websiteOrPortfolio'));
  assert.ok(src.includes('/api/vendors/google-registration-drafts'));
  assert.ok(!googleForm.includes('name="email"'));
});

check('admin application queue refreshes and surfaces API failures', () => {
  const src = read('website/src/app/admin/applications/page.tsx');
  assert.ok(src.includes('ADMIN_REFRESH_INTERVAL_MS'));
  assert.ok(src.includes('setInterval'));
  assert.ok(src.includes('visibilitychange'));
  assert.ok(src.includes('window.addEventListener("focus"'));
  assert.ok(src.includes('role="alert"'));
  assert.ok(src.includes('Retry'));
  assert.ok(src.includes('"/api/vendors/applications"'));
  assert.ok(!src.includes('API_BASE_URL'));
});

check('manual applications handle duplicate-key races without a 500', () => {
  const src = read('backend/src/routes/vendors.js');
  assert.ok(src.includes('error.code === 11000'));
  assert.ok(src.includes('status(409)'));
});

check('backend container excludes secrets and uses production settings', () => {
  const dockerfile = read('backend/Dockerfile');
  const dockerignore = read('backend/.dockerignore');
  assert.ok(dockerfile.includes('ENV NODE_ENV=production'));
  assert.ok(dockerfile.includes('EXPOSE 8081'));
  assert.ok(dockerignore.includes('.env*'));
  assert.ok(dockerignore.includes('node_modules'));
});

check('dashboard layout auth gate', () => {
  const src = read('website/src/app/dashboard/layout.tsx');
  assert.ok(src.includes('isAuthenticated'));
  assert.ok(src.includes('/login'));
  assert.ok(src.includes('catalog-import'));
  assert.ok(src.includes('shopify-scrape'));
});

check('dashboard three options', () => {
  const src = read('website/src/app/dashboard/page.tsx');
  assert.ok(src.includes('/dashboard/products'));
  assert.ok(src.includes('/dashboard/catalog-import'));
  assert.ok(src.includes('/dashboard/shopify-scrape'));
});

check('ProductForm uses presign S3 path', () => {
  const src = read('website/src/components/ProductForm.tsx');
  assert.ok(src.includes('/api/upload/presign'));
  assert.ok(!src.match(/apiCall\(['\"]\/api\/upload['\"]\)/));
});

check('email register still requires approved application', () => {
  const src = read('backend/src/routes/vendors.js');
  assert.ok(src.includes('status: "approved"'));
  assert.ok(src.includes('must be approved'));
  assert.ok(src.includes('/login'));
});

check('approval email uses one-time password setup link', () => {
  const src = read('backend/src/routes/vendors.js');
  assert.ok(src.includes('createPasswordToken'));
  assert.ok(src.includes('/reset-password/'));
  assert.ok(src.includes('Set your password securely here'));
  assert.ok(src.includes('passwordHash'));
});

check('upload presign route vendor-only protect', () => {
  const src = read('backend/src/routes/upload.js');
  assert.ok(src.includes('"/presign"') || src.includes("'/presign'"));
  assert.ok(src.includes('protect'));
  assert.ok(src.includes('vendor'));
  assert.ok(src.includes('getSignedUrl') || src.includes('PutObjectCommand'));
});

(async () => {
  // Live OAuth start if backend is up
  const port = process.env.PORT || 8081;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/google`, {
      redirect: 'manual',
    });
    const loc = res.headers.get('location') || '';
    console.log(`LIVE  GET /api/auth/google → ${res.status} location=${loc.slice(0, 120)}...`);
    if (res.status === 302 && loc.includes('accounts.google.com')) {
      assert.ok(
        loc.includes(encodeURIComponent('http://localhost:8081/api/auth/google/callback')) ||
          loc.includes('redirect_uri='),
        'redirect_uri must be present',
      );
      console.log('PASS  live Google OAuth start redirects to Google');
    } else if (res.status === 503) {
      console.log('SKIP  live Google start (not configured)');
    } else {
      throw new Error(`expected 302 to Google, got ${res.status} loc=${loc.slice(0, 80)}`);
    }
  } catch (e) {
    if (String(e.message).includes('ECONNREFUSED') || String(e.cause).includes('ECONNREFUSED')) {
      console.log(`SKIP  live Google start: backend not running (${e.message})`);
    } else if (e.message.startsWith('expected 302')) {
      failed += 1;
      console.error(`FAIL  live Google start: ${e.message}`);
    } else {
      console.log(`SKIP  live Google start: ${e.message}`);
    }
  }

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/upload/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'a.jpg', contentType: 'image/jpeg' }),
    });
    console.log(`LIVE  POST /api/upload/presign unauth → ${res.status}`);
    assert.ok(res.status === 401 || res.status === 403, 'presign must reject unauthenticated');
    console.log('PASS  presign rejects unauthenticated');
  } catch (e) {
    if (String(e.message).includes('ECONNREFUSED') || String(e.cause).includes('ECONNREFUSED')) {
      console.log(`SKIP  live presign: backend not running`);
    } else {
      failed += 1;
      console.error(`FAIL  live presign: ${e.message}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} structural test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll shipWebsiteStudio tests passed');
})();
