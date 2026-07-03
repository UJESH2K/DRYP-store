const API_VERSION = () => process.env.SHOPIFY_API_VERSION || '2025-01';

// Sends a single GraphQL request to a shop's Admin API using a shop-scoped access token.
const shopifyGraphQL = async (shopDomain, accessToken, query, variables = {}) => {
  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION()}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify GraphQL request failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  if (body.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  return body.data;
};

module.exports = { shopifyGraphQL };
