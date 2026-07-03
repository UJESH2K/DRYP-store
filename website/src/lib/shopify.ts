// Mirrors backend/src/utils/shopifyOAuth.js's isValidShopDomain regex — keep in sync.
const SHOP_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

// Normalizes user input (bare subdomain, full domain, or a pasted store URL)
// into a `foo.myshopify.com` domain, or returns null if it can't be made valid.
// Validating client-side means a typo never round-trips to the backend at all.
export function normalizeShopDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "").split("/")[0];
  if (!value.endsWith(".myshopify.com")) {
    value = `${value}.myshopify.com`;
  }

  return SHOP_DOMAIN_REGEX.test(value) ? value : null;
}
