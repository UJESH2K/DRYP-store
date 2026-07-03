const mongoose = require('mongoose');

const ShopifyImportSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  shopDomain: { type: String, required: true },
  bulkOperationId: { type: String },
  status: {
    type: String,
    enum: ['queued', 'running', 'downloading', 'processing', 'completed', 'failed'],
    default: 'queued',
  },
  objectCount: { type: Number, default: 0 },
  productsImported: { type: Number, default: 0 },
  error: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('ShopifyImport', ShopifyImportSchema);
