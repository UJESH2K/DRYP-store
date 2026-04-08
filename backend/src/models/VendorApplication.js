const mongoose = require('mongoose');

const VendorApplicationSchema = new mongoose.Schema({
  studioName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  websiteOrPortfolio: { type: String, required: true }, 
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('VendorApplication', VendorApplicationSchema);