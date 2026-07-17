const crypto = require('crypto');

// Accepts both .myshopify.com and .shopify.com (custom domain mapping).
// Shopify's OAuth server validates the domain — we just need a sane shape.
const SHOP_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.myshopify\.com|\.shopify\.com)$/;

const isValidShopDomain = (shop) => typeof shop === 'string' && SHOP_DOMAIN_REGEX.test(shop);

const getCallbackUrl = () => `${process.env.SHOPIFY_APP_URL}/api/auth/shopify/callback`;

const buildAuthorizeUrl = ({ shop, state }) => {
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY,
    scope: process.env.SHOPIFY_SCOPES || 'read_products,read_collections',
    redirect_uri: getCallbackUrl(),
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
};

// Verifies Shopify's HMAC signature per their documented algorithm:
// https://shopify.dev/docs/apps/build/authentication-authorization/oauth/getting-started#step-3-confirm-installation
const verifyHmac = (query) => {
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  const digestBuffer = Buffer.from(digest, 'utf8');
  const hmacBuffer = Buffer.from(hmac, 'utf8');
  if (digestBuffer.length !== hmacBuffer.length) return false;
  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
};

const exchangeCodeForToken = async ({ shop, code }) => {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json(); // { access_token, scope }
};

module.exports = {
  isValidShopDomain,
  buildAuthorizeUrl,
  verifyHmac,
  exchangeCodeForToken,
};
