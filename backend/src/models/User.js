const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, required: false, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, required: false, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const PaymentMethodSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["card"] },
    last4: { type: String, required: true },
    brand: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    // passwordHash is required for email/password accounts; SSO
    // users (Phase 4B: Google sign-in) have no password.
    passwordHash: { type: String, required: false },
    googleId: { type: String, index: true, sparse: true, unique: true },
    authProvider: {
      type: String,
      enum: ["password", "google"],
      default: "password",
    },
    phone: { type: String, required: false },
    avatar: { type: String, required: false },
    addresses: { type: [AddressSchema], default: [] },
    paymentMethods: { type: [PaymentMethodSchema], default: [] },
    role: { type: String, enum: ["user", "vendor", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    // Soft-delete fields — used by DELETE /api/users/me. We
    // anonymize rather than hard-delete so historical orders
    // and reviews keep a stable reference.
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    likedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    preferences: {
      currency: { type: String, default: "USD" },
      categories: { type: [String], default: [] },
      colors: { type: [String], default: [] },
      brands: { type: [String], default: [] },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
