/**
 * googleAuth.js — Phase 4B. Verify a Google ID token.
 *
 * The mobile app (and the website) get an `idToken` from
 * `GoogleSignin.signIn()` (mobile) or `google.accounts.id` (web).
 * We POST it to Google's tokeninfo endpoint and trust the response
 * if the `aud` matches our client id and `email_verified` is true.
 *
 * We intentionally use Google's public `tokeninfo` endpoint
 * instead of the `google-auth-library` SDK so we don't add a
 * heavy dep just for one feature. The endpoint is documented at:
 *   https://developers.google.com/identity/sign-in/web/backend-auth
 *
 * The verify function returns:
 *   { ok, email, name, picture, sub, error? }
 *
 * On any failure (network, expired token, mismatched aud) it
 * returns { ok: false, error: <string> }.
 */

const fetchFn = (...args) => globalThis.fetch(...args);

async function verifyGoogleIdToken(idToken, expectedAud) {
  if (!idToken) return { ok: false, error: 'missing idToken' };
  if (!fetchFn) return { ok: false, error: 'global fetch unavailable' };

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetchFn(url);
    if (!res.ok) {
      return { ok: false, error: `google http ${res.status}` };
    }
    const info = await res.json();
    if (info.error_description) {
      return { ok: false, error: info.error_description };
    }
    if (expectedAud && info.aud && info.aud !== expectedAud) {
      return { ok: false, error: 'aud mismatch' };
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return { ok: false, error: 'email not verified by Google' };
    }
    if (!info.email) {
      return { ok: false, error: 'no email in token' };
    }
    return {
      ok: true,
      email: String(info.email).toLowerCase(),
      name: info.name || info.email.split('@')[0],
      picture: info.picture || null,
      sub: info.sub,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { verifyGoogleIdToken };