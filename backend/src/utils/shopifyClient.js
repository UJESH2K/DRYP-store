/**
 * shopifyClient.js — Phase 3D/3E/3F. Shopify Admin API wrapper.
 *
 * Three responsibilities:
 *  3D — push our stock to Shopify (`pushStock`)
 *  3E — read live inventory at checkout (`fetchInventory`)
 *  3F — circuit breaker around the API (`runWithBreaker`)
 *
 * The client is a thin POST wrapper around the GraphQL Admin API.
 * No extra SDK; we already have a working fetch (built into Node 20+).
 *
 * Why a circuit breaker:
 *   Shopify rate-limits and occasionally 5xxs. A vendor with a broken
 *   connection should not block other vendors' syncs, and we should
 *   not hammer Shopify with retries during an outage. The breaker
 *   opens after 3 consecutive failures and stays open for 5 minutes
 *   before allowing a single trial.
 *
 * Sync state lives on ShopifyConnection.sync; the route handlers
 * pass the doc in and the client updates it.
 */

const fetchFn = (...args) => globalThis.fetch(...args);

const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 5 * 60 * 1000; // 5 min

function isCircuitOpen(sync) {
  if (!sync || !sync.circuitOpenUntil) return false;
  return new Date(sync.circuitOpenUntil).getTime() > Date.now();
}

function recordSuccess(sync) {
  sync.consecutiveFailures = 0;
  sync.circuitOpenUntil = null;
  sync.lastError = null;
  sync.lastSyncAt = new Date();
}

function recordFailure(sync, err) {
  sync.consecutiveFailures = (sync.consecutiveFailures || 0) + 1;
  sync.lastError = err && err.message ? err.message : String(err);
  if (sync.consecutiveFailures >= BREAKER_THRESHOLD) {
    sync.circuitOpenUntil = new Date(Date.now() + BREAKER_OPEN_MS);
  }
}

async function gql(shop, token, query, variables = {}) {
  if (!fetchFn) throw new Error('global fetch unavailable; needs Node 18+');
  const url = `https://${shop}/admin/api/2024-04/graphql.json`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`shopify http ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error('shopify graphql: ' + JSON.stringify(json.errors).slice(0, 200));
  }
  return json.data;
}

const PUSH_STOCK_MUTATION = `
mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    userErrors { field message }
  }
}`;

const FETCH_INVENTORY_QUERY = `
query getInventory($id: ID!) {
  inventoryItem(id: $id) {
    id
    tracked
    inventoryLevel(locationId: null) { available }
  }
}`;

/**
 * Push a single product's stock to Shopify.
 *   conn: ShopifyConnection document
 *   productId: DRYP product ObjectId
 *   variantOptions: { Color: 'Red', Size: 'M' } — used to look up the mapping
 *   qty: number to push
 *
 * Returns { ok, error?, breakerOpen? }.
 */
async function pushStock(conn, productId, variantOptions, qty) {
  if (isCircuitOpen(conn.sync)) {
    return { ok: false, breakerOpen: true, error: 'circuit open' };
  }
  const key = JSON.stringify(variantOptions || {});
  const inventoryItemId = conn.productMap && conn.productMap.get(key);
  if (!inventoryItemId) {
    return { ok: false, error: 'no inventory_item_id mapping for this variant' };
  }
  try {
    await gql(conn.shop, conn.accessToken, PUSH_STOCK_MUTATION, {
      input: {
        reason: 'correction',
        name: 'available',
        changes: [{ inventoryItemId, delta: Number(qty) }],
      },
    });
    recordSuccess(conn.sync);
    return { ok: true };
  } catch (e) {
    recordFailure(conn.sync, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Read live inventory for a single variant at checkout time.
 * Returns the available qty (number) or null if the API is unavailable.
 *
 * Per Phase 3F: if the circuit is open, we *return null* (not an
 * error) so checkout proceeds using the last-known DB value. The
 * route can decide whether to add a banner.
 */
async function fetchInventory(conn, variantOptions) {
  if (!conn || !conn.enabled) return null;
  if (isCircuitOpen(conn.sync)) return null;
  const key = JSON.stringify(variantOptions || {});
  const inventoryItemId = conn.productMap && conn.productMap.get(key);
  if (!inventoryItemId) return null;
  try {
    const data = await gql(conn.shop, conn.accessToken, FETCH_INVENTORY_QUERY, { id: inventoryItemId });
    recordSuccess(conn.sync);
    return data && data.inventoryItem && data.inventoryItem.inventoryLevel
      ? Number(data.inventoryItem.inventoryLevel.available)
      : null;
  } catch (e) {
    recordFailure(conn.sync, e);
    return null;
  }
}

module.exports = {
  pushStock,
  fetchInventory,
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  BREAKER_THRESHOLD,
  BREAKER_OPEN_MS,
};