/**
 * Resolves a product image reference to a usable URI for React Native <Image>.
 *
 * Handles:
 * - Full HTTP(S) URLs → returned as-is
 * - S3 keys (bare or leading-slash) → served through backend /api/media proxy
 * - Empty/null/undefined → null (caller should show placeholder)
 *
 * After the C2/C3 backend fix, most images will be presigned S3 URLs (HTTP).
 * This utility is the single source of truth so no component has to guess.
 */
import { API_BASE_URL } from '../lib/config';

export function resolveImageUri(imageRef: string | undefined | null): string | null {
  if (!imageRef || typeof imageRef !== 'string') return null;
  const trimmed = imageRef.trim();
  if (!trimmed) return null;

  // Already a full URL (presigned S3, CDN, etc.) — use directly
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // S3 key — route through backend media proxy
  const key = trimmed.replace(/^\//, '');
  return `${API_BASE_URL}/api/media?key=${encodeURIComponent(key)}`;
}

/**
 * Returns the image URI, or a fallback if the image is missing/broken.
 * Use this as the source for <Image> components.
 */
export function imageUri(imageRef: string | undefined | null, fallback?: string): string | null {
  const resolved = resolveImageUri(imageRef);
  return resolved ?? fallback ?? null;
}
