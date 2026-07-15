const mongoose = require('mongoose');

const GoogleRegistrationDraftSchema = new mongoose.Schema({
  draftId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  studioName: {
    type: String,
    required: true,
    trim: true,
  },
  websiteOrPortfolio: {
    type: String,
    required: true,
    trim: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  consumedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// TTL index on expiresAt - documents are automatically removed when expiresAt is in the past
GoogleRegistrationDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GoogleRegistrationDraft', GoogleRegistrationDraftSchema);
