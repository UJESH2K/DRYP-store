/**
 * Phase 4B — Google sign-in tests.
 *
 * Stubs global.fetch to fake Google's tokeninfo endpoint. Verifies:
 *  - happy path: returns parsed email/name/picture/sub
 *  - aud mismatch: returns { ok: false, error: 'aud mismatch' }
 *  - email not verified: rejects
 *  - missing idToken: rejects
 *  - HTTP 400 from Google: rejects
 *  - error_description: rejects
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.MONGO_URI = 'mongodb://placeholder';

const { verifyGoogleIdToken } = require('../src/utils/googleAuth');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function setFetch(handler) {
  globalThis.fetch = handler;
}

(async () => {
  // 1. happy path
  setFetch(async (url) => {
    check('fetch: tokeninfo URL', url.includes('oauth2.googleapis.com/tokeninfo'));
    return {
      ok: true,
      json: async () => ({
        aud: 'my-client-id',
        sub: 'google-sub-1',
        email: 'user@example.com',
        email_verified: 'true',
        name: 'User',
        picture: 'https://example.com/avatar.png',
      }),
    };
  });
  const r1 = await verifyGoogleIdToken('id_token_xyz', 'my-client-id');
  check('happy: ok', r1.ok === true);
  check('happy: email', r1.email === 'user@example.com');
  check('happy: name=User', r1.name === 'User');
  check('happy: sub', r1.sub === 'google-sub-1');
  check('happy: picture', r1.picture === 'https://example.com/avatar.png');

  // 2. aud mismatch
  setFetch(async () => ({
    ok: true,
    json: async () => ({ aud: 'different-client', sub: 's1', email: 'a@b.com', email_verified: 'true' }),
  }));
  const r2 = await verifyGoogleIdToken('id_token', 'my-client-id');
  check('aud-mismatch: !ok', r2.ok === false);
  check('aud-mismatch: error', r2.error === 'aud mismatch');

  // 3. email not verified
  setFetch(async () => ({
    ok: true,
    json: async () => ({ aud: 'cid', sub: 's', email: 'a@b.com', email_verified: 'false' }),
  }));
  const r3 = await verifyGoogleIdToken('id_token', 'cid');
  check('unverified: !ok', r3.ok === false);
  check('unverified: error mentions verified', r3.error.includes('verified'));

  // 4. missing idToken
  const r4 = await verifyGoogleIdToken('', 'cid');
  check('missing: !ok', r4.ok === false);
  check('missing: error mentions idToken', r4.error.includes('idToken'));

  // 5. HTTP error
  setFetch(async () => ({ ok: false }));
  const r5 = await verifyGoogleIdToken('id_token', 'cid');
  check('http-err: !ok', r5.ok === false);
  check('http-err: error mentions http', r5.error.includes('http'));

  // 6. error_description
  setFetch(async () => ({
    ok: true,
    json: async () => ({ error_description: 'Invalid token', error: 'invalid_token' }),
  }));
  const r6 = await verifyGoogleIdToken('id_token', 'cid');
  check('desc-err: !ok', r6.ok === false);
  check('desc-err: passes through error_description', r6.error === 'Invalid token');

  // 7. email_verified boolean true (not just string)
  setFetch(async () => ({
    ok: true,
    json: async () => ({ aud: 'cid', sub: 's', email: 'a@b.com', email_verified: true }),
  }));
  const r7 = await verifyGoogleIdToken('id_token', 'cid');
  check('verified-true-bool: ok', r7.ok === true);

  // 8. no email
  setFetch(async () => ({
    ok: true,
    json: async () => ({ aud: 'cid', sub: 's', email_verified: 'true' }),
  }));
  const r8 = await verifyGoogleIdToken('id_token', 'cid');
  check('no-email: !ok', r8.ok === false);

  // 9. aud check skipped if not provided (some apps don't pin aud)
  setFetch(async () => ({
    ok: true,
    json: async () => ({ aud: 'anything', sub: 's', email: 'a@b.com', email_verified: 'true' }),
  }));
  const r9 = await verifyGoogleIdToken('id_token'); // no expected aud
  check('no-aud: ok (no mismatch check)', r9.ok === true);

  delete globalThis.fetch;
  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();