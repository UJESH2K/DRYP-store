const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName =
  process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const s3Client =
  bucketName && region ? new S3Client({ region }) : null;

function isAmazonS3Url(url) {
  if (typeof url !== "string" || !url.trim()) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (!host.endsWith("amazonaws.com")) return false;

    return host === "s3.amazonaws.com" || host.startsWith("s3.") || host.includes(".s3.");
  } catch {
    return false;
  }
}

function extractS3Key(input) {
  if (typeof input !== "string" || !input.trim()) return null;

  if (input.startsWith("/api/media?")) {
    try {
      const parsed = new URL(input, "http://localhost");
      const key = parsed.searchParams.get("key");
      return key ? decodeURIComponent(key) : null;
    } catch {
      return null;
    }
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    if (!isAmazonS3Url(input)) return null;

    try {
      const parsed = new URL(input);
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    } catch {
      return null;
    }
  }

  return input.replace(/^\//, "");
}

function normalizeImageKeys(images = []) {
  return Array.from(
    new Set(
      (Array.isArray(images) ? images : [])
        .map((image) => extractS3Key(image))
        .filter(Boolean),
    ),
  );
}

function normalizeProductImages(product) {
  if (!product) return product;

  const plainProduct =
    product && typeof product.toObject === "function" ? product.toObject() : { ...product };

  plainProduct.images = normalizeImageKeys(plainProduct.images);

  if (Array.isArray(plainProduct.variants)) {
    plainProduct.variants = plainProduct.variants.map((variant) => ({
      ...variant,
      images: normalizeImageKeys(variant.images),
    }));
  }

  return plainProduct;
}

async function signImageKey(key, expiresIn = 60 * 15) {
  if (!key || typeof key !== "string") return key;
  if (!s3Client || key.startsWith("http://") || key.startsWith("https://")) return key;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key.replace(/^\//, ""),
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

async function signProductImages(product, expiresIn = 60 * 15) {
  if (!product) return product;

  const plainProduct =
    product && typeof product.toObject === "function" ? product.toObject() : { ...product };

  plainProduct.images = await Promise.all(
    normalizeImageKeys(plainProduct.images).map((key) =>
      signImageKey(key, expiresIn),
    ),
  );

  if (Array.isArray(plainProduct.variants)) {
    plainProduct.variants = await Promise.all(
      plainProduct.variants.map(async (variant) => ({
        ...variant,
        images: await Promise.all(
          normalizeImageKeys(variant.images).map((key) => signImageKey(key, expiresIn)),
        ),
      })),
    );
  }

  return plainProduct;
}

module.exports = {
  extractS3Key,
  isAmazonS3Url,
  normalizeProductImages,
  normalizeImageKeys,
  signProductImages,
  signImageKey,
};
