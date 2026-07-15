const path = require('path');

const ALLOWED_EXTENSIONS = /jpeg|jpg|png|gif|webp/;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Shared validation for S3 presign requests (Manual product images).
 * @returns {string|null} error message or null if valid
 */
function validateUploadPayload({ fileName, contentType, fileSize }) {
  if (!fileName || typeof fileName !== 'string') {
    return 'fileName is required';
  }
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return 'contentType must be one of image/jpeg, image/png, image/gif, image/webp';
  }
  if (!ALLOWED_EXTENSIONS.test(path.extname(fileName).toLowerCase())) {
    return 'fileName must have a .jpg, .jpeg, .png, .gif, or .webp extension';
  }
  if (fileSize !== undefined && fileSize !== null) {
    const size = Number(fileSize);
    if (!Number.isFinite(size) || size <= 0) {
      return 'fileSize must be a positive number';
    }
    if (size > MAX_BYTES) {
      return `fileSize must be <= ${MAX_BYTES} bytes`;
    }
  }
  return null;
}

module.exports = {
  validateUploadPayload,
  ALLOWED_CONTENT_TYPES,
  MAX_BYTES,
};
