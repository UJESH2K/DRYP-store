const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
}, { _id: false });

const ShopifyIntegrationSchema = new mongoose.Schema({
  shopDomain: { type: String, unique: true, sparse: true, index: true },
  accessTokenEnc: { type: String, select: false },
  scope: { type: String },
  connectedAt: { type: Date },
  importStatus: {
    type: String,
    enum: ['not_connected', 'pending', 'importing', 'completed', 'failed'],
    default: 'not_connected',
  },
  importError: { type: String },
  lastImportedAt: { type: Date },
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
  shopify: { type: ShopifyIntegrationSchema, default: () => ({}) },
}, { timestamps: true });

VendorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.shopify) delete ret.shopify.accessTokenEnc;
    return ret;
  },
});

module.exports = mongoose.model('Vendor', VendorSchema);