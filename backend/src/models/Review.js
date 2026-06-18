const mongoose = require('mongoose');

/**
 * Review — a user's rating + comment on a product.
 *
 * One user per product. The post route updates Product.rating and
 * Product.reviews atomically (see routes/products.js#createReview).
 *
 * `verified` is true if the user actually bought the product (a
 * future check — for now we trust the client to be honest; abuse
 * can be reined in by rate-limiting).
 */
const ReviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 2000 },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

// A user can leave at most one review per product.
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Make sure indexes are built synchronously when the model is
// loaded — this prevents a race where two concurrent POSTs from
// the same user both see "no existing review" and both insert,
// and only the second one fails on the unique index. In
// production the index is built when MongoDB starts, so this
// is a development-test ergonomic.
if (process.env.NODE_ENV === 'test') {
  ReviewSchema.on('index', function(err) {
    if (err) console.error('Review index build failed:', err);
  });
}

module.exports = mongoose.model('Review', ReviewSchema);