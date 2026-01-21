const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  company: { type: String, required: false, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, required: false, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Home', 'Work', 'Other'], default: 'Home' },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const PaymentMethodSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['card'] },
  last4: { type: String, required: true },
  brand: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, required: false },
  avatar: { type: String, required: false },
  addresses: { type: [AddressSchema], default: [] },
  paymentMethods: { type: [PaymentMethodSchema], default: [] },
  role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  likedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  preferences: {
    currency: { type: String, default: 'USD' },
    categories: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    brands: { type: [String], default: [] },
  },

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);


