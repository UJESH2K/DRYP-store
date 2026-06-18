const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const Product = require("../models/Product");
const { requireAdmin, requireVendor } = require("../middleware/requireRole");
const requireEmailConfig = require("../middleware/requireEmailConfig");
const router = express.Router();
const mongoose = require("mongoose");
const VendorApplication = require("../models/VendorApplication");
const sendEmail = require("../utils/sendEmail");
const logger = require("../utils/logger");

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
router.put("/applications/:id", requireAdmin, requireEmailConfig, async (req, res, next) => {
  let status;
try {
    ({ status } = req.body); // 'approved' or 'rejected'
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status update." });
    }

    const application = await VendorApplication.findById(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    // Idempotency: if the application is already in the requested state,
    // don't re-send the email or re-update timestamps. Just return success.
    if (application.status === status) {
      return res.json({
        message: `Application already ${status}. No action taken.`,
      });
    }

    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

    // Send the email FIRST. If the email throws, we return 502 and the DB
    // state is unchanged. This avoids the previous bug where the
    // application was marked "approved" in Mongo but the email never went
    // out — the vendor would then try to register and find their application
    // in an inconsistent state.
    //
    // Phase 0E: on a transient SMTP failure (e.g. SMTP server
    // bouncing), we fall back to the background queue with retries.
    // The synchronous `await` blocks long enough to catch "wrong
    // email address" (4xx) — those should NOT be silently retried,
    // they should fail loud. But a timeout / 5xx / DNS error
    // shouldn't kill the whole approval; it should retry.
    const queue = require("../utils/jobQueue");
    const sendOnce = async () => {
      if (status === "approved") {
        return sendEmail({
          email: application.email,
          subject: "DRYP: Studio Approved",
          message: `Your application has been accepted. You may now create your account at: ${frontendUrl}/signup`,
        });
      }
      return sendEmail({
        email: application.email,
        subject: "DRYP: Application Status",
        message: `Thank you for your interest in DRYP. Unfortunately, your studio does not align with our current curation. We wish you the best.`,
      });
    };

    let emailSent = false;
    let lastErr = null;
    try {
      await sendOnce();
      emailSent = true;
    } catch (err) {
      lastErr = err;
      // 4xx errors: don't retry, re-throw so the admin sees the error.
      // For everything else, hand it to the queue and accept the
      // approval anyway — the queue will retry up to 3 times.
      const msg = String(err && err.message).toLowerCase();
      const isPermanent = msg.includes("invalid") || msg.includes("not found") || /\b4\d\d\b/.test(msg);
      if (isPermanent) throw err;
      // Phase 0E: enqueue for background retry. We do NOT block
      // the admin request on this.
      await queue.enqueue(
        "sendVendorApprovalEmail",
        {
          email: application.email,
          status,
          frontendUrl,
        },
        { attempts: 3, backoff: { type: "exponential", delay: 30_000 } },
      );
      // The approval succeeds; the email is in flight. The admin
      // gets a slightly different response so they know to expect
      // a delay.
      emailSent = "queued";
    }

    // Email confirmed sent. Now commit the state change.
    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = Date.now();
    await application.save();

    res.json({
      message: `Application ${status} successfully.${
        emailSent === "queued" ? " Email queued for retry." : " Email dispatched."
      }`,
    });
  } catch (error) {
    // If sendEmail threw, surface a 502 (Bad Gateway) so the admin knows
    // it's a third-party issue (SMTP) and not a server bug. The DB write
    // never happened, so the application is still in its prior state.
    if (
      error &&
      (error.code === "EAUTH" ||
        error.code === "ECONNECTION" ||
        error.code === "ETIMEDOUT" ||
        /SMTP|email/i.test(error.message || ""))
    ) {
      logger.error(
        { err: error.message, applicationId: req.params.id, status },
        "vendor_application_email_failed",
      );
      return res.status(502).json({
        message:
          "Could not send the application status email. The application " +
          "state has not been changed. Please check SMTP configuration and " +
          "try again.",
      });
    }
    next(error);
  }
});

// @route   GET /api/vendors/applications
// @desc    Admin: View all applications
// @access  Private (Admin Only)
router.get("/applications", requireAdmin, async (req, res, next) => {
  try {
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
router.get("/me/products", requireVendor, async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res
        .status(404)
        .json({ message: "Vendor profile not found for this user" });
    }

    // `Product.vendor` references the owning *User* (_id), not the Vendor
    // document. Filter by the User id (req.user._id) so vendors actually
    // see their own products.
    const products = await Product.find({ vendor: req.user._id });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me
// @desc    Get the logged-in vendor's profile
// @access  Private (Vendor only)
router.get("/me", requireVendor, async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
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
router.put("/me", requireVendor, async (req, res, next) => {
  try {
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

// @route   GET /api/vendors/shopify
// @desc    Get the vendor's Shopify connection (token is
//          never returned; the frontend just gets status
//          fields).
// @access  Private (Vendor only)
router.get("/shopify", requireVendor, async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    if (!vendor.shopify?.shop) return res.json({ enabled: false });
    res.json({
      enabled: !!vendor.shopify.enabled,
      shop: vendor.shopify.shop,
      status: vendor.shopify.enabled ? 'connected' : 'disconnected',
      lastSyncedAt: vendor.shopify.lastSyncedAt,
      productsSynced: vendor.shopify.productsSynced,
    });
  } catch (error) { next(error); }
});

// @route   PUT /api/vendors/shopify
// @desc    Connect a Shopify store. The access token is
//          encrypted at rest with AES-256-GCM (see
//          utils/shopifyCrypto).
// @access  Private (Vendor only)
router.put("/shopify", requireVendor, async (req, res, next) => {
  try {
    const { shop, accessToken } = req.body || {};
    if (!shop || !accessToken) {
      return res.status(400).json({ message: "shop and accessToken are required" });
    }
    // Loose shop-domain check. Don't accept a URL with a path.
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
      return res.status(400).json({ message: "Shop must look like 'my-store.myshopify.com'" });
    }
    const { encrypt } = require('../utils/shopifyCrypto');
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    vendor.shopify = vendor.shopify || {};
    vendor.shopify.shop = shop;
    vendor.shopify.accessToken = encrypt(accessToken);
    vendor.shopify.enabled = true;
    vendor.shopify.lastSyncError = undefined;
    await vendor.save();
    res.json({
      ok: true,
      enabled: true,
      shop: vendor.shopify.shop,
      status: 'connected',
      lastSyncedAt: vendor.shopify.lastSyncedAt,
      productsSynced: vendor.shopify.productsSynced,
    });
  } catch (error) { next(error); }
});

// @route   POST /api/vendors/shopify/test
// @desc    Run a one-off health check against Shopify: list
//          products and report the count. We do this on a
//          separate endpoint so a misconfigured connection
//          doesn't poison the connection-write path.
// @access  Private (Vendor only)
router.post("/shopify/test", requireVendor, async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor?.shopify?.accessToken) {
      return res.json({ ok: false, message: "Not connected" });
    }
    const { decrypt } = require('../utils/shopifyCrypto');
    const token = decrypt(vendor.shopify.accessToken);
    const url = `https://${vendor.shopify.shop}/admin/api/2024-04/products/count.json`;
    const res2 = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });
    if (!res2.ok) {
      const body = await res2.text();
      vendor.shopify.enabled = false;
      vendor.shopify.lastSyncError = `HTTP ${res2.status}: ${body.slice(0, 200)}`;
      await vendor.save();
      return res.json({ ok: false, message: vendor.shopify.lastSyncError });
    }
    const data = await res2.json();
    vendor.shopify.enabled = true;
    vendor.shopify.lastSyncError = undefined;
    vendor.shopify.lastSyncedAt = new Date();
    vendor.shopify.productsSynced = data.count || 0;
    await vendor.save();
    res.json({ ok: true, productsCount: data.count || 0 });
  } catch (error) { next(error); }
});

// @route   DELETE /api/vendors/shopify
// @desc    Disconnect Shopify and wipe the stored token.
// @access  Private (Vendor only)
router.delete("/shopify", requireVendor, async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    vendor.shopify = undefined;
    await vendor.save();
    res.json({ ok: true });
  } catch (error) { next(error); }
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
router.get("/admin/directory", requireAdmin, async (req, res, next) => {
  try {
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
router.put("/admin/suspend/:vendorId", requireAdmin, requireEmailConfig, async (req, res, next) => {
  try {
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
