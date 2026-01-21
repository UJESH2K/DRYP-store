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
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);