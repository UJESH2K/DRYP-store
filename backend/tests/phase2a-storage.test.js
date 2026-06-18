/**
 * Phase 2A — storage provider tests.
 *
 * Verifies:
 *  - Local provider writes a file to public/uploads and returns
 *    /uploads/<key>.
 *  - Local remove() handles ENOENT.
 *  - S3 provider is *selected* when env is set (we don't hit S3;
 *    we assert the configuration check + provider() helper).
 *  - S3 provider returns a useful error if the SDK isn't installed.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.MONGO_URI = 'mongodb://placeholder';

delete process.env.STORAGE_PROVIDER;
delete process.env.AWS_S3_BUCKET;

const fs = require('fs');
const path = require('path');
const storage = require('../src/utils/storageProvider');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  // 1. local put
  check('provider: local default', storage.provider() === 'local');
  check('isS3Configured: false', storage.isS3Configured() === false);

  const buf = Buffer.from('fake-image-bytes');
  const r1 = await storage.put(buf, 'test-' + Date.now() + '.png', 'image/png');
  check('local put: ok', r1.ok === true);
  check('local put: provider=local', r1.provider === 'local');
  check('local put: url starts with /uploads/', r1.url && r1.url.startsWith('/uploads/'));
  const filePath = storage.localPath(r1.key);
  check('local put: file exists on disk', fs.existsSync(filePath));
  const readBack = fs.readFileSync(filePath);
  check('local put: file contents match', readBack.equals(buf));

  // 2. local remove
  const r2 = await storage.remove(r1.key);
  check('local remove: ok', r2.ok === true);
  check('local remove: file is gone', !fs.existsSync(filePath));

  // 3. local remove missing file
  const r3 = await storage.remove('does-not-exist.png');
  check('local remove missing: ok with alreadyGone', r3.ok === true && r3.alreadyGone === true);

  // 4. S3 selected when env set
  process.env.STORAGE_PROVIDER = 's3';
  process.env.AWS_S3_BUCKET = 'test-bucket';
  delete require.cache[require.resolve('../src/utils/storageProvider')];
  const storage2 = require('../src/utils/storageProvider');
  check('s3: provider → s3', storage2.provider() === 's3');
  check('s3: isS3Configured → true', storage2.isS3Configured() === true);
  // The S3 put requires the @aws-sdk package; if it's not installed,
  // it returns a useful error. Either way, the codepath is exercised.
  const r4 = await storage2.put(buf, 'k.png', 'image/png');
  if (r4.ok) {
    check('s3 put: provider=s3', r4.provider === 's3');
  } else {
    check('s3 put: error string helpful',
      typeof r4.error === 'string' && r4.error.includes('@aws-sdk'));
  }

  // 5. isS3Configured requires both env vars
  delete process.env.AWS_S3_BUCKET;
  delete require.cache[require.resolve('../src/utils/storageProvider')];
  const storage3 = require('../src/utils/storageProvider');
  check('s3: needs bucket → isS3Configured=false', storage3.isS3Configured() === false);
  check('s3: needs bucket → provider=local', storage3.provider() === 'local');

  // restore
  delete process.env.STORAGE_PROVIDER;
  delete process.env.AWS_S3_BUCKET;

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();