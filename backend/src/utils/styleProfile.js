const Like = require('../models/Like');
const WishlistItem = require('../models/WishlistItem');
const Cart = require('../models/Cart');
const User = require('../models/User');

/**
 * Build a compact style profile for the LLM context.
 * Aggregates: user preferences + liked products + wishlist + cart items.
 */
async function buildStyleProfile(userId, guestId) {
  const profile = { categories: [], colors: [], brands: [], recentLikes: [], recentWishlist: [], recentCart: [], preferences: null };

  if (userId) {
    const user = await User.findById(userId).select('preferences name').lean();
    if (user?.preferences) {
      profile.preferences = user.preferences;
      profile.categories = user.preferences.categories || [];
      profile.colors = user.preferences.colors || [];
      profile.brands = user.preferences.brands || [];
    }
  }

  const query = userId ? { user: userId } : { guestId };
  if (userId || guestId) {
    const likes = await Like.find(query)
      .populate({ path: 'product', select: 'name brand category tags basePrice' })
      .sort({ createdAt: -1 }).limit(10).lean();
    profile.recentLikes = likes.filter(l => l.product).map(l => ({
      name: l.product.name, brand: l.product.brand, category: l.product.category,
      tags: l.product.tags || [], price: l.product.basePrice,
    }));

    const wishlist = await WishlistItem.find(query)
      .populate({ path: 'product', select: 'name brand category tags basePrice' })
      .sort({ createdAt: -1 }).limit(8).lean();
    profile.recentWishlist = wishlist.filter(w => w.product).map(w => ({
      name: w.product.name, brand: w.product.brand, category: w.product.category, price: w.product.basePrice,
    }));

    const cart = await Cart.findOne(query)
      .populate({ path: 'items.product', select: 'name brand category basePrice' }).lean();
    if (cart?.items) {
      profile.recentCart = cart.items.filter(i => i.product).map(i => ({
        name: i.product.name, brand: i.product.brand, category: i.product.category,
        price: i.product.basePrice, quantity: i.quantity,
      }));
    }
  }

  const parts = [];
  if (profile.preferences) {
    const p = profile.preferences;
    if (p.categories?.length) parts.push(`Preferred categories: ${p.categories.join(', ')}`);
    if (p.colors?.length) parts.push(`Preferred colors: ${p.colors.join(', ')}`);
    if (p.brands?.length) parts.push(`Preferred brands: ${p.brands.join(', ')}`);
  }
  if (profile.recentLikes.length) {
    parts.push(`Recently liked: ${profile.recentLikes.slice(0, 6).map(l => `${l.name} by ${l.brand} (${l.category})`).join('; ')}`);
  }
  if (profile.recentWishlist.length) {
    parts.push(`In wishlist: ${profile.recentWishlist.slice(0, 5).map(w => `${w.name} by ${w.brand}`).join('; ')}`);
  }
  if (profile.recentCart.length) {
    parts.push(`In cart: ${profile.recentCart.map(c => `${c.name} by ${c.brand} (qty ${c.quantity})`).join('; ')}`);
  }

  return parts.length > 0 ? `User style profile:\n${parts.join('\n')}` : 'No style profile available yet — user is new.';
}

module.exports = { buildStyleProfile };
