/**
 * Tests for S3 presign payload validation (Manual catalog images).
 * Runs: node tests/uploadValidation.test.js
 */
const assert = require('assert');
const { validateUploadPayload } = require('../src/utils/uploadValidation');

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

check('accepts valid jpeg', () => {
  assert.strictEqual(
    validateUploadPayload({ fileName: 'a.jpg', contentType: 'image/jpeg', fileSize: 1000 }),
    null,
  );
});

check('rejects missing fileName', () => {
  assert.ok(validateUploadPayload({ contentType: 'image/jpeg' }));
});

check('rejects bad content type', () => {
  assert.ok(validateUploadPayload({ fileName: 'a.jpg', contentType: 'application/pdf' }));
});

check('rejects bad extension', () => {
  assert.ok(validateUploadPayload({ fileName: 'a.exe', contentType: 'image/jpeg' }));
});

check('rejects oversize', () => {
  assert.ok(
    validateUploadPayload({
      fileName: 'a.png',
      contentType: 'image/png',
      fileSize: 11 * 1024 * 1024,
    }),
  );
});

// Prove upload route imports the same validator
check('upload route uses shared validateUploadPayload', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/upload.js'), 'utf8');
  assert.ok(src.includes("require(\"../utils/uploadValidation\")") || src.includes("require('../utils/uploadValidation')"));
  assert.ok(src.includes('/presign'));
  assert.ok(src.includes('protect'));
  assert.ok(src.includes('vendor'));
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll uploadValidation tests passed');
