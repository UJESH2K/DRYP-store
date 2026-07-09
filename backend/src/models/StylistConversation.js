const mongoose = require('mongoose');

const StylistMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  imageUrl: { type: String },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { _id: false, timestamps: { createdAt: true, updatedAt: false } });

const StylistConversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guestId: { type: String, index: true },
  title: { type: String, default: 'New styling session' },
  messages: { type: [StylistMessageSchema], default: [] },
}, { timestamps: true });

// Auto-delete after 30 days
StylistConversationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
StylistConversationSchema.index({ user: 1, updatedAt: -1 });
StylistConversationSchema.index({ guestId: 1, updatedAt: -1 });

module.exports = mongoose.model('StylistConversation', StylistConversationSchema);
