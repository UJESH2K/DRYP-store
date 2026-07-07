const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const router = express.Router();

const bucketName =
  process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const s3Client =
  bucketName && region ? new S3Client({ region }) : null;

function extractKeyFromRequest(input) {
  if (!input || typeof input !== "string") return null;

  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const parsed = new URL(input);
      if (!parsed.hostname.endsWith("amazonaws.com")) return null;
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    }
    return decodeURIComponent(input.replace(/^\//, ""));
  } catch {
    return null;
  }
}

router.get("/", async (req, res, next) => {
  try {
    if (!s3Client || !bucketName) {
      return res.status(503).json({ message: "S3 is not configured." });
    }

    const key = extractKeyFromRequest(req.query.key);
    const urlKey = extractKeyFromRequest(req.query.url);
    const resolvedKey = key || urlKey;

    if (!resolvedKey) {
      return res.status(400).json({ message: "A valid S3 key is required." });
    }

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: resolvedKey,
      }),
    );

    if (response.ContentType) {
      res.setHeader("Content-Type", response.ContentType);
    }
    if (response.CacheControl) {
      res.setHeader("Cache-Control", response.CacheControl);
    }
    if (response.ContentLength) {
      res.setHeader("Content-Length", String(response.ContentLength));
    }

    res.setHeader("Cache-Control", "private, max-age=300");

    const body = response.Body;
    if (!body || typeof body.pipe !== "function") {
      return res.status(500).json({ message: "Unable to stream image." });
    }

    body.pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
