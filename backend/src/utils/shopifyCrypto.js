/**
 * shopifyCrypto.js — encrypt the Shopify admin access token
 * at rest so a leaked DB doesn't leak every vendor's store.
 *
 * Algorithm: AES-256-GCM. Key is derived from
 * process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY (must be 32 bytes,
 * base64). A random 12-byte IV is prepended to the ciphertext
 * for each encryption.
 *
 * If no key is configured, encryption is a no-op and the
 * token is stored in plaintext — this is the dev-mode path
 * and is loud about it (a startup log line tells the operator
 * encryption is disabled). Production must set the key.
 */
const crypto = require('crypto');

const KEY_ENV = 'SHOPIFY_TOKEN_ENCRYPTION_KEY';
let cachedKey = undefined;
let warnedNoKey = false;

function getKey() {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env[KEY_ENV];
  if (!raw) {
    if (!warnedNoKey) {
      console.warn(
        '[shopifyCrypto] SHOPIFY_TOKEN_ENCRYPTION_KEY is not set — ' +
        'tokens will be stored in plaintext. Set this in production.',
      );
      warnedNoKey = true;
    }
    cachedKey = null;
    return null;
  }
  // The key can be 32 raw bytes or base64-encoded 32 bytes.
  // Try base64 first; if the result is 32 bytes, use it.
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) { cachedKey = buf; return cachedKey; }
  } catch (_) {}
  const buf = Buffer.from(raw);
  if (buf.length === 32) { cachedKey = buf; return cachedKey; }
  // Derive a 32-byte key from arbitrary input via sha256.
  cachedKey = crypto.createHash('sha256').update(raw).digest();
  return cachedKey;
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getKey();
  if (!key) return plaintext; // dev fallback
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: <iv><tag><ciphertext>, base64
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(payload) {
  if (payload == null) return null;
  const key = getKey();
  if (!key) return payload; // dev fallback (plaintext)
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 28) return null; // 12 iv + 16 tag + at least 1 byte
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };