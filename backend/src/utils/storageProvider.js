/**
 * storageProvider.js — Phase 2A. Pluggable file storage.
 *
 * Why a provider abstraction:
 *   - Dev: local disk (current behavior, no config needed).
 *   - Prod: S3 (durable, scales, no local-disk dependency on the
 *     AWS container).
 *
 * The provider is chosen at boot from env:
 *   - STORAGE_PROVIDER=s3  +  AWS_S3_BUCKET  → use S3
 *   - otherwise                                → local disk
 *
 * Routes call `storage.put(buffer, key, mime)` and get back
 *   { ok, key, url, provider }
 *
 * In dev, `key` is the filename on disk; `url` is the
 * /uploads/<key> path that the existing static-serving route in
 * server.js exposes. Backward-compatible with the current
 * client behavior.
 *
 * In S3 mode, `key` is the S3 object key; `url` is the public
 * bucket URL (or a presigned URL if the bucket is private —
 * configurable via S3_PUBLIC).
 *
 * The `@aws-sdk/client-s3` package is loaded lazily so the dev
 * path doesn't need it installed.
 */

const path = require('path');
const fs = require('fs');

function getS3() {
  try {
    return require('@aws-sdk/client-s3');
  } catch (e) {
    return null;
  }
}

function localPath(key) {
  return path.join(__dirname, '../../public/uploads', key);
}

function isS3Configured() {
  return process.env.STORAGE_PROVIDER === 's3' && Boolean(process.env.AWS_S3_BUCKET);
}

async function localPut(buffer, key, _mime) {
  const dest = localPath(key);
  await fs.promises.writeFile(dest, buffer);
  return {
    ok: true,
    provider: 'local',
    key,
    url: `/uploads/${key}`,
  };
}

let _s3Client = null;
function s3Client() {
  if (_s3Client) return _s3Client;
  const S3 = getS3();
  if (!S3) throw new Error('@aws-sdk/client-s3 not installed (npm i @aws-sdk/client-s3)');
  const region = process.env.AWS_REGION || 'us-east-1';
  _s3Client = new S3.S3Client({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined, // fall back to IAM role
  });
  return _s3Client;
}

async function s3Put(buffer, key, mime) {
  const S3 = getS3();
  if (!S3) return { ok: false, provider: 's3', error: '@aws-sdk/client-s3 not installed' };
  const client = s3Client();
  const bucket = process.env.AWS_S3_BUCKET;
  const isPublic = process.env.S3_PUBLIC === 'true';
  const cmd = new S3.PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mime,
    ACL: isPublic ? 'public-read' : undefined,
  });
  try {
    await client.send(cmd);
    const region = process.env.AWS_REGION || 'us-east-1';
    const url = isPublic
      ? `https://${bucket}.s3.${region}.amazonaws.com/${key}`
      : null; // presigned GET not generated here; routes that need it can call s3GetSignedUrl
    return { ok: true, provider: 's3', key, url, bucket, region };
  } catch (e) {
    return { ok: false, provider: 's3', error: e.message };
  }
}

async function put(buffer, key, mime) {
  if (isS3Configured()) {
    return s3Put(buffer, key, mime);
  }
  return localPut(buffer, key, mime);
}

async function remove(key) {
  if (isS3Configured()) {
    const S3 = getS3();
    if (!S3) return { ok: false, provider: 's3', error: 's3 pkg not installed' };
    try {
      await s3Client().send(new S3.DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      }));
      return { ok: true, provider: 's3' };
    } catch (e) {
      return { ok: false, provider: 's3', error: e.message };
    }
  }
  // local
  try {
    await fs.promises.unlink(localPath(key));
    return { ok: true, provider: 'local' };
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: true, provider: 'local', alreadyGone: true };
    return { ok: false, provider: 'local', error: e.message };
  }
}

function provider() {
  return isS3Configured() ? 's3' : 'local';
}

module.exports = { put, remove, provider, isS3Configured, localPath };