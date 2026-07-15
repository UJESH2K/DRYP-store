const mongoose = require('mongoose');

const CatalogImportSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  status: {
    type: String,
    enum: ['uploaded', 'previewed', 'importing', 'completed', 'failed'],
    default: 'uploaded',
  },
  fileName: { type: String },
  fileSize: { type: Number },
  totalRows: { type: Number, default: 0 },
  skippedRows: [{
    row: { type: Number },
    reason: { type: String },
  }],
  importedCount: { type: Number, default: 0 },
  products: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  batchProgress: {
    current: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  error: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('CatalogImport', CatalogImportSchema);
