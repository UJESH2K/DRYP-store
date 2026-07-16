export const isS3ImageUrl = (url?: string | null) => {
  if (!url || typeof url !== "string" || !url.trim()) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (!host.endsWith("amazonaws.com")) return false;

    return host === "s3.amazonaws.com" || host.startsWith("s3.") || host.includes(".s3.");
  } catch {
    return false;
  }
};

export const extractImageKey = (url?: string | null) => {
  if (!url || typeof url !== "string" || !url.trim()) return null;

  if (url.startsWith("/api/media?")) {
    try {
      const parsed = new URL(url, "http://localhost");
      return parsed.searchParams.get("key");
    } catch {
      return null;
    }
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (!isS3ImageUrl(url)) return null;

    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    } catch {
      return null;
    }
  }

  return url.replace(/^\//, "");
};

const resolveApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
       return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || "";
};

export const getRenderableImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("/api/media?")) {
    const apiBaseUrl = resolveApiBaseUrl();
    return `${apiBaseUrl}${url}`;
  }
  if (isS3ImageUrl(url)) {
    const key = extractImageKey(url);
    if (!key) return url;

    const apiBaseUrl = resolveApiBaseUrl();
    return `${apiBaseUrl}/api/media?key=${encodeURIComponent(key)}`;
  }

  const key = extractImageKey(url);
  if (!key) return url;

  const apiBaseUrl = resolveApiBaseUrl();
  return `${apiBaseUrl}/api/media?key=${encodeURIComponent(key)}`;
};

export const getS3StorageImages = (images: Array<string | null | undefined> = []) =>
  Array.from(
    new Set(
      images
        .map((image) => extractImageKey(image))
        .filter((image): image is string => Boolean(image)),
    ),
  );

export const getS3Images = (images: Array<string | null | undefined> = []) =>
  Array.from(new Set(images.filter((image): image is string => isS3ImageUrl(image))));

export const getPrimaryProductImage = (product: {
  images?: Array<string | null | undefined>;
  variants?: Array<{ images?: Array<string | null | undefined> }>;
}) => {
  const images = [
    ...(product.images || []),
    ...((product.variants || []).flatMap((variant) => variant.images || [])),
  ];

  const primary = images.find((image) => Boolean(image)) || "";
  return getRenderableImageUrl(primary);
};
