const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  size: { type: String, required: false },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  guestId: { type: String, required: false, index: true },
  items: { type: [OrderItemSchema], required: true },
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['cart', 'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    company: { type: String, required: false },
    line1: { type: String, required: true },
    line2: { type: String, required: false },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true },
  },
  orderNumber: { type: String, unique: true, sparse: true }, // Unique order number, sparse allows nulls
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  trackingHistory: [{
    status: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  cancelledAt: { type: Date },
  cancelledReason: { type: String },
  deliveredAt: { type: Date },
}, { timestamps: true });

// Add a tracking history entry on every status change. We hook
// into the model's `pre('save')` to keep the history in sync
// without the routes having to remember to write it.
OrderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.trackingHistory.push({
      status: this.status,
      note: this._pendingTrackingNote || '',
      by: this._pendingTrackingBy,
      at: new Date(),
    });
    this._pendingTrackingNote = undefined;
    this._pendingTrackingBy = undefined;
    if (this.status === 'cancelled' && !this.cancelledAt) this.cancelledAt = new Date();
    if (this.status === 'delivered' && !this.deliveredAt) this.deliveredAt = new Date();
  }
  next();
});

// `findOneAndUpdate` and `findByIdAndUpdate` bypass the `pre('save')`
// hook, so we mirror the same logic on the query hooks. This covers
// routes that update order.status with `Order.findByIdAndUpdate`.
OrderSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  const status = update.status || update.$set?.status;
  if (!status) return next();
  const entry = { status, at: new Date() };
  if (Array.isArray(update.$push?.trackingHistory)) {
    update.$push.trackingHistory.push(entry);
  } else {
    update.$push = { ...(update.$push || {}), trackingHistory: entry };
  }
  if (status === 'cancelled' && !update.cancelledAt && !update.$set?.cancelledAt) {
    update.$set = { ...(update.$set || {}), cancelledAt: new Date() };
  }
  if (status === 'delivered' && !update.deliveredAt && !update.$set?.deliveredAt) {
    update.$set = { ...(update.$set || {}), deliveredAt: new Date() };
  }
  this.setUpdate(update);
  next();
});

module.exports = mongoose.model('Order', OrderSchema);