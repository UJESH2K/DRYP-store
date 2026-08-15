/**
 * Resolve the website base URL for user-facing links (password resets,
 * OAuth redirects, vendor setup links).
 *
 * Falls back to the production site so links never point at localhost
 * when the env var is unset. Local dev sets NEXT_PUBLIC_FRONTEND_URL
 * explicitly in backend/.env.
 */
function frontendUrl() {
  return process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.dryp.store";
}

module.exports = { frontendUrl };