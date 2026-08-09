const mongoose = require('mongoose');

const InteractionEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guestId: { type: String, index: true },
  action: {
    type: String, required: true,
    enum: ['swipe_left','swipe_right','swipe_up','like','unlike','wishlist_add','wishlist_remove','cart_add','cart_remove','product_view','checkout_start','order_placed','chat_interest'],
    index: true,
  },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productSnapshot: { name: String, brand: String, category: String, tags: [String], basePrice: Number },
  source: { type: String, default: 'swipe_feed' },
  swipeVelocity: Number,
  dwellTimeMs: Number,
}, { timestamps: true });

InteractionEventSchema.index({ user: 1, action: 1, createdAt: -1 });
InteractionEventSchema.index({ product: 1, action: 1, createdAt: -1 });
InteractionEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InteractionEvent', InteractionEventSchema);
