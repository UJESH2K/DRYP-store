const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
}, { _id: false });

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: AddressSchema, required: false },
  phone: { type: String, required: false },
  website: { type: String, trim: true },
  logo: { type: String },
  isActive: { type: Boolean, default: true },
  // Shopify integration. The accessToken is stored encrypted
  // (see utils/shopifyCrypto). The shop domain is stored in
  // plaintext because it's not a secret — it's the public
  // *.myshopify.com address.
  shopify: {
    enabled: { type: Boolean, default: false },
    shop: { type: String, trim: true },
    accessToken: { type: String }, // encrypted at rest
    lastSyncedAt: { type: Date },
    lastSyncError: { type: String },
    productsSynced: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);