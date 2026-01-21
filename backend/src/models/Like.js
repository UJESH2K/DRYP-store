const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true }, // User is not required for guest likes
  guestId: { type: String, required: false, index: true }, // For anonymous users
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
}, { timestamps: true });

LikeSchema.index({ user: 1, product: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });
LikeSchema.index({ guestId: 1, product: 1 }, { unique: true, partialFilterExpression: { guestId: { $exists: true } } });

module.exports = mongoose.model('Like', LikeSchema);


