const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const rateLimit = require("express-rate-limit");
const { protect } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_EXTENSIONS = /jpeg|jpg|png|gif|webp/;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const bucketName =
  process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const publicBaseUrl = process.env.AWS_S3_PUBLIC_URL;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3Client =
  bucketName && region ? new S3Client({ region }) : null;

// Manual presigned URL generation without checksum headers
function createPresignedUrl({ bucket, key, expiresIn = 300 }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const endpoint = `https://${host}/${key}`;

  // Create canonical request
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  // Only sign the host header - no checksum headers
  const signedHeaders = "host";

  // Create canonical request (GET for presigned URL)
  const canonicalUri = `/${key}`;
  const canonicalQuerystring = [
    `X-Amz-Algorithm=${algorithm}`,
    `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
    `x-id=PutObject`,
  ].join("&");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuerystring,
    `host:${host}`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  // Create string to sign
  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");

  // Calculate signature
  const kDate = crypto
    .createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(dateStamp)
    .digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  // Build final URL
  const signedUrl = `${endpoint}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

  return signedUrl;
}

function buildPublicUrl(key) {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${encodeURI(key)}`;
  }

  return `https://${bucketName}.s3.${region}.amazonaws.com/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function buildKey(originalName) {
  const fileExtension =
    path.extname(originalName || "").toLowerCase() || ".jpg";
  return `uploads/${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")}${fileExtension}`;
}

// Stricter than the auth login limiter because each request mints a URL that
// can be used to push arbitrary amounts of data to S3.
const uploadPresignLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { message: "Too many upload requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

function assertS3Configured() {
  if (!s3Client || !accessKeyId || !secretAccessKey) {
    const error = new Error(
      "AWS S3 is not configured. Set AWS_BUCKET_NAME, AWS_REGION, and AWS credentials."
    );
    error.status = 503;
    throw error;
  }
}

function validateUploadPayload({ fileName, contentType, fileSize }) {
  if (!fileName || typeof fileName !== "string") {
    return "fileName is required";
  }
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return "contentType must be one of image/jpeg, image/png, image/gif, image/webp";
  }
  if (!ALLOWED_EXTENSIONS.test(path.extname(fileName).toLowerCase())) {
    return "fileName must have a .jpg, .jpeg, .png, .gif, or .webp extension";
  }
  const maxBytes = 10 * 1024 * 1024;
  if (fileSize !== undefined && fileSize !== null) {
    const size = Number(fileSize);
    if (!Number.isFinite(size) || size <= 0) {
      return "fileSize must be a positive number";
    }
    if (size > maxBytes) {
      return `fileSize must be <= ${maxBytes} bytes`;
    }
  }
  return null;
}

// POST /api/upload/presign
// Body: { fileName: string, contentType: string, fileSize?: number }
// Returns: { url: string, key: string, publicUrl: string, expiresIn: number }
router.post(
  "/presign",
  protect,
  uploadPresignLimiter,
  async (req, res, next) => {
    try {
      if (req.user.role !== "vendor") {
        return res
          .status(403)
          .json({ message: "Forbidden: Only vendors can upload images." });
      }

      try {
        assertS3Configured();
      } catch (configError) {
        return res
          .status(configError.status || 500)
          .json({ message: configError.message });
      }

      const { fileName, contentType, fileSize } = req.body || {};
      const validationError = validateUploadPayload({
        fileName,
        contentType,
        fileSize,
      });
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const key = buildKey(fileName);
      const expiresIn = 60 * 5; // 5 minutes

      // Use manual presigning to avoid SDK adding checksum headers
      const url = createPresignedUrl({
        bucket: bucketName,
        key: key,
        expiresIn,
      });

      return res.status(200).json({
        url,
        key,
        publicUrl: buildPublicUrl(key),
        expiresIn,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
