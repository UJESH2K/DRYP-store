const InteractionEvent = require('../models/InteractionEvent');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');

/**
 * Price tier thresholds (fashion-appropriate)
 * low: < $30, mid: $30-100, high: > $100
 */
const PRICE_TIERS = {
  LOW: { max: 30 },
  MID: { min: 30, max: 100 },
  HIGH: { min: 100 },
};

function getPriceTier(price) {
  if (price == null) return null;
  if (price < PRICE_TIERS.LOW.max) return 'low';
  if (price <= PRICE_TIERS.MID.max) return 'mid';
  return 'high';
}

function priceTierMatch(profileAvgPrice, productPrice) {
  if (profileAvgPrice == null || productPrice == null) return null;
  const profileTier = getPriceTier(profileAvgPrice);
  const productTier = getPriceTier(productPrice);
  if (profileTier === productTier) return 1.0;
  const tiers = ['low', 'mid', 'high'];
  const profileIdx = tiers.indexOf(profileTier);
  const productIdx = tiers.indexOf(productTier);
  if (Math.abs(profileIdx - productIdx) === 1) return 0.5;
  return 0;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractColorsFromProduct(product) {
  const colors = new Set();
  if (Array.isArray(product.tags)) {
    for (const tag of product.tags) {
      const lower = tag.toLowerCase();
      colors.add(lower);
    }
  }
  if (Array.isArray(product.options)) {
    for (const opt of product.options) {
      if (opt.name && opt.name.toLowerCase() === 'color' && Array.isArray(opt.values)) {
        for (const val of opt.values) {
          colors.add(val.toLowerCase());
        }
      }
    }
  }
  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (variant.options && typeof variant.options === 'object') {
        for (const [key, val] of Object.entries(variant.options)) {
          if (key.toLowerCase() === 'color' && val) {
            colors.add(val.toLowerCase());
          }
        }
      }
    }
  }
  return colors;
}

function colorMatchScore(productColors, preferredColors, likedColors) {
  if (!productColors || productColors.size === 0) return 0;
  for (const c of productColors) {
    if (preferredColors.has(c)) return 1.0;
  }
  for (const c of productColors) {
    if (likedColors.has(c)) return 0.5;
  }
  return 0;
}

/**
 * Build a structured user profile from preferences and interaction events.
 * @param {string|null} userId
 * @param {string|null} guestId
 * @returns {Promise<Object>} profile object
 */
async function buildUserProfile(userId, guestId) {
  const profile = {
    preferences: null,
    preferredBrands: new Set(),
    preferredCategories: new Set(),
    preferredColors: new Set(),
    likedBrands: new Set(),
    likedCategories: new Set(),
    likedColors: new Set(),
    avgPrice: null,
    tasteVector: null,
  };

  if (userId) {
    const user = await User.findById(userId).select('preferences').lean();
    if (user?.preferences) {
      profile.preferences = user.preferences;
      if (Array.isArray(user.preferences.brands)) {
        for (const b of user.preferences.brands) profile.preferredBrands.add(b.toLowerCase());
      }
      if (Array.isArray(user.preferences.categories)) {
        for (const c of user.preferences.categories) profile.preferredCategories.add(c.toLowerCase());
      }
      if (Array.isArray(user.preferences.colors)) {
        for (const c of user.preferences.colors) profile.preferredColors.add(c.toLowerCase());
      }
    }
  }

  const query = userId ? { user: userId } : { guestId };
  if (userId || guestId) {
    const POSITIVE_ACTIONS = new Set([
      'swipe_right', 'like', 'wishlist_add', 'cart_add', 'checkout_start', 'order_placed', 'chat_interest',
    ]);
    const NEGATIVE_ACTIONS = new Set([
      'swipe_left', 'unlike', 'wishlist_remove', 'cart_remove',
    ]);

    const events = await InteractionEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    let priceSum = 0;
    let priceCount = 0;

    for (const ev of events) {
      const snap = ev.productSnapshot;
      if (!snap) continue;
      const isPositive = POSITIVE_ACTIONS.has(ev.action);
      const isNegative = NEGATIVE_ACTIONS.has(ev.action);

      if (snap.brand) {
        const brandLower = snap.brand.toLowerCase();
        if (isPositive) profile.likedBrands.add(brandLower);
      }
      if (snap.category) {
        const catLower = snap.category.toLowerCase();
        if (isPositive) profile.likedCategories.add(catLower);
      }
      if (snap.tags && Array.isArray(snap.tags)) {
        for (const tag of snap.tags) {
          const tagLower = tag.toLowerCase();
          if (isPositive) profile.likedColors.add(tagLower);
        }
      }
      if (isPositive && typeof snap.basePrice === 'number') {
        priceSum += snap.basePrice;
        priceCount++;
      }
    }

    // Also consider cart items for avgPrice
    if (userId || guestId) {
      const cart = await Cart.findOne(query).populate({ path: 'items.product', select: 'basePrice' }).lean();
      if (cart?.items) {
        for (const item of cart.items) {
          if (item.product && typeof item.product.basePrice === 'number') {
            priceSum += item.product.basePrice;
            priceCount++;
          }
        }
      }
    }

    if (priceCount > 0) {
      profile.avgPrice = priceSum / priceCount;
    }
  }

  return profile;
}

/**
 * Build a taste vector by averaging embeddings of positively-interacted products.
 * @param {Object} profile - output of buildUserProfile
 * @returns {Promise<number[]|null>}
 */
async function buildTasteVector(profile) {
  const query = profile._userId ? { user: profile._userId } : { guestId: profile._guestId };
  // We need to re-fetch positive events to get product IDs with embeddings
  // Since profile doesn't carry event IDs, we'll query InteractionEvent again
  // but only for products that have embeddings.
  // This function expects profile to have _userId and _guestId attached by caller.
  const POSITIVE_ACTIONS = new Set([
    'swipe_right', 'like', 'wishlist_add', 'cart_add', 'checkout_start', 'order_placed', 'chat_interest',
  ]);

  const events = await InteractionEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const productIds = [];
  const weights = [];
  const now = Date.now();

  for (const ev of events) {
    if (!POSITIVE_ACTIONS.has(ev.action)) continue;
    if (!ev.product) continue;
    productIds.push(ev.product);
    // Recency weight: 1 / (1 + daysSinceEvent)
    const daysSince = (now - new Date(ev.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    weights.push(1 / (1 + daysSince));
  }

  if (productIds.length === 0) return null;

  const products = await Product.find({ _id: { $in: productIds }, embedding: { $exists: true, $ne: null } })
    .select('embedding')
    .lean();

  if (products.length === 0) return null;

  // Map productId -> embedding for weighting
  const embeddingMap = new Map();
  for (const p of products) {
    embeddingMap.set(p._id.toString(), p.embedding);
  }

  const dim = products[0].embedding.length;
  const sumVec = new Array(dim).fill(0);
  let totalWeight = 0;

  for (let i = 0; i < productIds.length; i++) {
    const pid = productIds[i].toString();
    const emb = embeddingMap.get(pid);
    if (!emb) continue;
    const w = weights[i];
    for (let d = 0; d < dim; d++) {
      sumVec[d] += emb[d] * w;
    }
    totalWeight += w;
  }

  if (totalWeight === 0) return null;

  for (let d = 0; d < dim; d++) {
    sumVec[d] /= totalWeight;
  }

  return sumVec;
}

/**
 * Score a single product against a profile.
 * @param {Object} product - plain product object (from .lean())
 * @param {Object} profile - output of buildUserProfile (with tasteVector attached)
 * @returns {number} score 0..1
 */
function scoreProduct(product, profile) {
  const brandLower = (product.brand || '').toLowerCase();
  const catLower = (product.category || '').toLowerCase();

  const brandMatch = profile.preferredBrands.has(brandLower) ? 1.0
    : profile.likedBrands.has(brandLower) ? 0.5 : 0;

  const categoryMatch = profile.preferredCategories.has(catLower) ? 1.0
    : profile.likedCategories.has(catLower) ? 0.5 : 0;

  const productColors = extractColorsFromProduct(product);
  const colorMatch = colorMatchScore(productColors, profile.preferredColors, profile.likedColors || new Set());

  const priceMatch = priceTierMatch(profile.avgPrice, product.basePrice);

  let embeddingSim = 0;
  if (profile.tasteVector && product.embedding && product.embedding.length) {
    embeddingSim = cosineSimilarity(profile.tasteVector, product.embedding);
  }

  // Weights: brand 0.3, category 0.3, color 0.2, price 0.1, embedding 0.1
  const weights = {
    brand: 0.3,
    category: 0.3,
    color: 0.2,
    price: 0.1,
    embedding: 0.1,
  };

  let score = 0;
  let availableWeight = 0;

  if (brandMatch !== null) {
    score += brandMatch * weights.brand;
    availableWeight += weights.brand;
  }
  if (categoryMatch !== null) {
    score += categoryMatch * weights.category;
    availableWeight += weights.category;
  }
  if (colorMatch !== null) {
    score += colorMatch * weights.color;
    availableWeight += weights.color;
  }
  if (priceMatch !== null) {
    score += priceMatch * weights.price;
    availableWeight += weights.price;
  }
  if (embeddingSim !== null && profile.tasteVector && product.embedding) {
    score += embeddingSim * weights.embedding;
    availableWeight += weights.embedding;
  }

  if (availableWeight === 0) return 0.5; // neutral fallback
  return score / availableWeight;
}

/**
 * Score and rank an array of products.
 * @param {Object[]} products - array of plain product objects
 * @param {Object} profile - output of buildUserProfile (with tasteVector attached)
 * @returns {Promise<Object[]>} products with score field, sorted desc
 */
async function scoreProducts(products, profile) {
  const scored = products.map(p => ({
    ...p,
    score: scoreProduct(p, profile),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

module.exports = {
  buildUserProfile,
  buildTasteVector,
  scoreProduct,
  scoreProducts,
  getPriceTier,
  priceTierMatch,
  cosineSimilarity,
  extractColorsFromProduct,
  colorMatchScore,
};