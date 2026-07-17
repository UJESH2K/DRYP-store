const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
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

function normalizeImageRef(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  const value = input.trim();

  if (value.startsWith("/api/media?")) {
    try {
      const parsed = new URL(value, "http://localhost");
      const key = parsed.searchParams.get("key");
      return key ? decodeURIComponent(key) : null;
    } catch {
      return null;
    }
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    if (isAmazonS3Url(value)) {
      try {
        const parsed = new URL(value);
        return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
      } catch {
        return null;
      }
    }
    return value;
  }

  return value.replace(/^\//, "");
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
        .map((image) => normalizeImageRef(image))
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
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (!s3Client) return key;

  const cleanKey = key.replace(/^\//, "");
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: cleanKey }),
    );
  } catch {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

async function signProductImages(product, expiresIn = 60 * 15) {
  if (!product) return product;

  const plainProduct =
    product && typeof product.toObject === "function"
      ? product.toObject()
      : { ...product };

  const images = Array.isArray(plainProduct.images) ? plainProduct.images : [];
  plainProduct.images = (await Promise.all(
    images.map((key) => signImageKey(key, expiresIn)),
  )).filter(Boolean);

  if (Array.isArray(plainProduct.variants)) {
    plainProduct.variants = await Promise.all(
      plainProduct.variants.map(async (variant) => ({
        ...variant,
        images: (await Promise.all(
          (variant.images || []).map((key) => signImageKey(key, expiresIn)),
        )).filter(Boolean),
      })),
    );
  }

  return plainProduct;
}

module.exports = {
  extractS3Key,
  isAmazonS3Url,
  normalizeImageRef,
  normalizeProductImages,
  normalizeImageKeys,
  signProductImages,
  signImageKey,
};
