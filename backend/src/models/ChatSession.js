const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['user', 'assistant', 'system', 'tool'] },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ChatSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestId: { type: String },
  messages: { type: [MessageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Sparse unique indexes: one session per user, one per guestId
ChatSessionSchema.index({ user: 1 }, { unique: true, sparse: true });
ChatSessionSchema.index({ guestId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ChatSession', ChatSessionSchema);