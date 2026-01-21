const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true }, // Price at the time of adding to cart
  options: {
    size: String,
    color: String,
  }
}, { _id: false });

const CartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guestId: { type: String, index: true },
  items: { type: [CartItemSchema], default: [] },
}, { timestamps: true });

// Either user or guestId must be present
CartSchema.pre('save', function(next) {
  if (!this.user && !this.guestId) {
    next(new Error('A cart must be associated with a user or a guest.'));
  }
  next();
});

module.exports = mongoose.model('Cart', CartSchema);
