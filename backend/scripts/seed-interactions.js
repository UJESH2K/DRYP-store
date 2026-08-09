/**
 * Seed sample Like + InteractionEvent records for client data-capture review.
 *
 * Run: node scripts/seed-interactions.js
 *
 * Produces:
 *   - 25 Like documents (mixed authenticated + guest)
 *   - 25 InteractionEvent documents (swipe_left/right/up, product_view)
 *   - JSON dump to scripts/sample-export.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Like = require('../src/models/Like');
const InteractionEvent = require('../src/models/InteractionEvent');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

const GUEST_IDS = [
  'guest_anon_a1b2c3',
  'guest_anon_d4e5f6',
  'guest_anon_g7h8i9',
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const products = await Product.find().limit(30).select('_id name brand category tags basePrice').lean();
  const users = await User.find().limit(5).select('_id').lean();

  if (products.length < 5) {
    throw new Error(`Need at least 5 products in DB, found ${products.length}`);
  }

  // Wipe prior seed runs so re-running is idempotent
  await InteractionEvent.deleteMany({ source: 'sample_seed' });
  await Like.deleteMany({ _sampleSeed: true });
  console.log('Cleared prior sample_seed docs');

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // --- 25 InteractionEvents ----------------------------------------------
  const actions = ['swipe_right', 'swipe_left', 'swipe_up', 'product_view'];
  const sources = ['swipe_feed', 'product_detail', 'wishlist_modal', 'cart_modal'];
  const events = [];

  for (let i = 0; i < 25; i++) {
    const product = products[i % products.length];
    const isAuth = i % 2 === 0;
    const userId = isAuth ? users[i % users.length]._id : null;
    const guestId = isAuth ? null : GUEST_IDS[i % GUEST_IDS.length];
    const action = actions[i % actions.length];

    events.push({
      user: userId,
      guestId,
      action,
      product: product._id,
      productSnapshot: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        tags: product.tags || [],
        basePrice: product.basePrice,
      },
      source: 'sample_seed',
      swipeVelocity: action.startsWith('swipe') ? Number((Math.random() * 800 + 200).toFixed(1)) : undefined,
      dwellTimeMs: action === 'product_view' ? Math.floor(Math.random() * 4000 + 500) : undefined,
      createdAt: new Date(now - (25 - i) * 60 * 60 * 1000), // last 25h, spread out
    });
  }
  await InteractionEvent.insertMany(events);
  console.log(`Inserted ${events.length} InteractionEvent docs`);

  // --- 25 Likes (mixed auth + guest) --------------------------------------
  const likeDocs = [];
  for (let i = 0; i < 25; i++) {
    const product = products[(i + 3) % products.length];
    const isAuth = i % 3 !== 0; // 2/3 auth, 1/3 guest
    likeDocs.push({
      user: isAuth ? users[i % users.length]._id : undefined,
      guestId: isAuth ? undefined : GUEST_IDS[i % GUEST_IDS.length],
      product: product._id,
      _sampleSeed: true,
      createdAt: new Date(now - (25 - i) * 90 * 60 * 1000),
    });
  }
  await Like.insertMany(likeDocs);
  console.log(`Inserted ${likeDocs.length} Like docs`);

  // --- Export to JSON -----------------------------------------------------
  const dump = {
    generatedAt: new Date().toISOString(),
    counts: { interactionEvents: events.length, likes: likeDocs.length },
    interactionEvents: events.map((e) => ({
      id: String(e._id || new mongoose.Types.ObjectId()),
      user: e.user ? String(e.user) : null,
      guestId: e.guestId,
      action: e.action,
      product: String(e.product),
      productSnapshot: e.productSnapshot,
      source: e.source,
      swipeVelocity: e.swipeVelocity,
      dwellTimeMs: e.dwellTimeMs,
      timestamp: e.createdAt.toISOString(),
    })),
    likes: likeDocs.map((l) => ({
      user: l.user ? String(l.user) : null,
      guestId: l.guestId,
      product: String(l.product),
      timestamp: l.createdAt.toISOString(),
    })),
  };

  const outPath = path.join(__dirname, 'sample-export.json');
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));
  console.log(`Exported to ${outPath}`);
  console.log(`Sample InteractionEvent[0]:`);
  console.log(JSON.stringify(dump.interactionEvents[0], null, 2));

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
