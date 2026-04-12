const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");
const router = express.Router();
const mongoose = require("mongoose");
const VendorApplication = require("../models/VendorApplication");
const sendEmail = require("../utils/sendEmail");

// @route   POST /api/vendors/apply
// @desc    Submit a studio application to the waitlist
// @access  Public
router.post("/apply", async (req, res, next) => {
  try {
    const { studioName, email, websiteOrPortfolio } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email is already registered." });

    const existingApp = await VendorApplication.findOne({ email });
    if (existingApp) {
      return res.status(400).json({
        message: `Your application is currently ${existingApp.status}.`,
      });
    }

    await VendorApplication.create({ studioName, email, websiteOrPortfolio });

    res
      .status(201)
      .json({
        message:
          "Application submitted successfully. We will review your dossier.",
      });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/applications/:id
// @desc    Admin: Approve or Reject a vendor application
// @access  Private (Admin Only)
router.put("/applications/:id", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only." });
    }

    const { status } = req.body; // 'approved' or 'rejected'
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status update." });
    }

    const application = await VendorApplication.findById(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = Date.now();
    await application.save();

    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

    if (status === "approved") {
      await sendEmail({
        email: application.email,
        subject: "DRYP: Studio Approved",
        message: `Your application has been accepted. You may now create your account at: ${frontendUrl}/signup`,
      });
    } else {
      await sendEmail({
        email: application.email,
        subject: "DRYP: Application Status",
        message: `Thank you for your interest in DRYP. Unfortunately, your studio does not align with our current curation. We wish you the best.`,
      });
    }

    res.json({
      message: `Application ${status} successfully. Email dispatched.`,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/applications
// @desc    Admin: View all applications
// @access  Private (Admin Only)
router.get("/applications", protect, async (req, res, next) => {
  console.log(req.user);
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    const applications = await VendorApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/register
// @desc    Register a new vendor and user
// @access  Public
router.post("/register", async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const application = await VendorApplication.findOne({
      email,
      status: "approved",
    });
    console.log(application);
    if (!application) {
      return res.status(403).json({
        message:
          "Forbidden. Your email must be approved by DRYP administration before registering.",
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const createdUsers = await User.create(
        [
          {
            name: name,
            email,
            passwordHash,
            role: "vendor",
          },
        ],
        { session },
      );

      user = createdUsers[0];

      const vendor = await Vendor.create(
        [
          {
            name: `${name}'s Studio`,
            email,
            owner: user._id,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      const userObj = user.toObject();
      delete userObj.passwordHash;

      res.status(201).json({ token, user: userObj, vendor: vendor[0] });
    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. CRITICAL FIX: The Bouncer. Reject standard shoppers.
    if (user.role !== "vendor") {
      return res.status(403).json({
        message:
          "Access denied. This portal is for registered studios only. Please use the mobile app.",
      });
    }

    // 3. Verify Password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 4. Enforce Bans
    if (!user.isActive) {
      return res.status(403).json({ message: "Account suspended." });
    }

    // 5. Fetch their specific Vendor profile
    const vendor = await Vendor.findOne({ owner: user._id });

    // 6. Mint the token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // 7. Strip the hash
    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.json({ token, user: userObj, vendor });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me/products
// @desc    Get all products for the logged-in vendor
// @access  Private (Vendor only)
router.get("/me/products", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only vendors can access this route" });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res
        .status(404)
        .json({ message: "Vendor profile not found for this user" });
    }

    const products = await Product.find({ vendor: vendor._id });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me
// @desc    Get the logged-in vendor's profile
// @access  Private (Vendor only)
router.get("/me", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only vendors can access this route" });
    }
    console.log("Searching for vendor with owner ID:", req.user._id);
    const vendor = await Vendor.findOne({ owner: req.user._id });
    console.log("Found vendor:", vendor);
    if (!vendor) {
      return res
        .status(404)
        .json({ message: "Vendor profile not found for this user" });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/me
// @desc    Update the logged-in vendor's profile
// @access  Private (Vendor only)
router.put("/me", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only vendors can access this route" });
    }
    const vendor = await Vendor.findOneAndUpdate(
      { owner: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!vendor) {
      return res
        .status(404)
        .json({ message: "Vendor profile not found for this user" });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/:id
router.get("/:id", async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/:id/products
router.get("/:id/products", async (req, res, next) => {
  try {
    const products = await Product.find({
      vendor: req.params.id,
      isActive: true,
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/admin/directory
// @desc    Admin: Get all officially registered studios
// @access  Private (Admin Only)
router.get("/admin/directory", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    // We populate the owner to get their email and isActive suspension status
    const vendors = await Vendor.find().populate(
      "owner",
      "email isActive createdAt",
    );
    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/admin/suspend/:vendorId
// @desc    Admin: Toggle a studio's suspension status and email them
// @access  Private (Admin Only)
router.put("/admin/suspend/:vendorId", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    // 1. Find the Vendor and their associated User account
    const vendor = await Vendor.findById(req.params.vendorId).populate("owner");
    if (!vendor || !vendor.owner) {
      return res
        .status(404)
        .json({ message: "Studio or associated user account not found." });
    }

    const user = await User.findById(vendor.owner._id);

    // 2. Flip the active switch
    user.isActive = !user.isActive;
    await user.save();

    // 3. Dispatch the appropriate email
    const statusWord = user.isActive ? "restored" : "suspended";
    const emailSubject = user.isActive
      ? "DRYP: Studio Access Restored"
      : "DRYP: Studio Access Suspended";
    const emailMessage = user.isActive
      ? "Your studio access to the DRYP platform has been fully restored. You may now log in to the portal."
      : "Your studio access to the DRYP platform has been suspended by administration. You will no longer be able to log in. Please reply to this email for further clarification.";

    await sendEmail({
      email: user.email,
      subject: emailSubject,
      message: emailMessage,
    });

    res.json({
      message: `Studio access ${statusWord} successfully. Notification dispatched.`,
      isActive: user.isActive,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
