const mongoose = require('mongoose');

const VendorApplicationSchema = new mongoose.Schema({
  studioName: { type: String, required: true, trim: true },
  // Business / contact email (used for admin notices and vendor profile)
  email: { type: String, required: true, unique: true, lowercase: true },
  // Optional Google login email — if set, Google OAuth may match this instead of contact email
  googleEmail: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    index: true,
    sparse: true,
  },
  // Verified Google identity from OAuth callback (authoritative, not client-supplied)
  verifiedGoogleEmail: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
  },
  verifiedGoogleId: {
    type: String,
    required: false,
    trim: true,
  },
  websiteOrPortfolio: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });

VendorApplicationSchema.index(
  { verifiedGoogleEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { verifiedGoogleEmail: { $type: 'string' } },
  },
);
VendorApplicationSchema.index(
  { verifiedGoogleId: 1 },
  {
    unique: true,
    partialFilterExpression: { verifiedGoogleId: { $type: 'string' } },
  },
);

module.exports = mongoose.model('VendorApplication', VendorApplicationSchema);
