const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");
const router = express.Router();
const mongoose = require("mongoose");
const VendorApplication = require("../models/VendorApplication");
const ShopifyImport = require("../models/ShopifyImport");
const CatalogImport = require("../models/CatalogImport");
const sendEmail = require("../utils/sendEmail");
const {
  parseCatalogFile,
  groupRowsIntoProducts,
  buildProductBulkOps,
} = require("../utils/catalogImport");

const MAX_CATALOG_FILE_SIZE_MB = 100;
const BULK_BATCH_SIZE = 100;

const catalogUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CATALOG_FILE_SIZE_MB * 1024 * 1024 },
});

// Wraps multer's single-file middleware so size/type errors come back as a
// clean 400 with a helpful message instead of falling through to the generic
// 500 error handler (multer errors aren't `instanceof Error` in a way that
// carries a `.status`, so they'd otherwise be reported as server errors).
const catalogUploadSingle = (req, res, next) => {
  catalogUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `File is too large. Maximum size is ${MAX_CATALOG_FILE_SIZE_MB}MB.`,
        });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) return next(err);
    next();
  });
};

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

// @route   POST /api/vendors/me/catalog-preview
// @desc    Vendor: Parse an uploaded spreadsheet into draft products for review
// @access  Private (Vendor only)
router.post(
  "/me/catalog-preview",
  protect,
  catalogUploadSingle,
  async (req, res, next) => {
    try {
      if (req.user.role !== "vendor") {
        return res
          .status(403)
          .json({ message: "Forbidden: Only vendors can access this route" });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "No file uploaded (expected field name 'file')." });
      }

      const vendor = await Vendor.findOne({ owner: req.user._id });
      if (!vendor) {
        return res.status(404).json({ message: "Vendor profile not found" });
      }

      const rows = await parseCatalogFile(req.file.buffer, req.file.originalname);
      const { products, skippedRows } = groupRowsIntoProducts(rows);

      const catalogImport = await CatalogImport.create({
        vendor: vendor._id,
        status: "previewed",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        totalRows: products.reduce((sum, p) => sum + (p.variants?.length || 1), 0),
        skippedRows,
        products,
      });

      res.json({ importId: catalogImport._id, products, skippedRows });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  },
);

// @route   POST /api/vendors/me/catalog-import
// @desc    Vendor: Commit reviewed products into their own catalog
// @access  Private (Vendor only)
router.post("/me/catalog-import", protect, async (req, res, next) => {
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

    let products;
    let catalogImportId = null;

    if (req.body.importId) {
      const catalogImport = await CatalogImport.findOne({
        _id: req.body.importId,
        vendor: vendor._id,
        status: "previewed",
      });
      if (!catalogImport) {
        return res.status(400).json({ message: "Import session not found. Please re-upload the file." });
      }
      products = catalogImport.products;
      catalogImportId = catalogImport._id;
    } else {
      products = req.body.products;
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "No products to import." });
    }

    const ops = buildProductBulkOps(vendor, products);

    if (catalogImportId) {
      await CatalogImport.findByIdAndUpdate(catalogImportId, {
        $set: {
          status: "importing",
          batchProgress: { current: 0, total: Math.ceil(ops.length / BULK_BATCH_SIZE) },
        },
      });
    }

    let imported = 0;
    for (let i = 0; i < ops.length; i += BULK_BATCH_SIZE) {
      const batch = ops.slice(i, i + BULK_BATCH_SIZE);
      await Product.bulkWrite(batch);
      imported += batch.length;

      if (catalogImportId) {
        await CatalogImport.findByIdAndUpdate(catalogImportId, {
          $set: { "batchProgress.current": Math.ceil(imported / BULK_BATCH_SIZE) },
        });
      }
    }

    if (catalogImportId) {
      await CatalogImport.findByIdAndUpdate(catalogImportId, {
        $set: {
          status: "completed",
          importedCount: imported,
          completedAt: new Date(),
          batchProgress: { current: Math.ceil(ops.length / BULK_BATCH_SIZE), total: Math.ceil(ops.length / BULK_BATCH_SIZE) },
        },
      });
    }

    res.json({ imported });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me/catalog-imports
// @desc    Vendor: Get import history
// @access  Private (Vendor only)
router.get("/me/catalog-imports", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor profile not found" });
    }

    const imports = await CatalogImport.find({ vendor: vendor._id })
      .select("status fileName fileSize totalRows importedCount skippedRows error batchProgress createdAt completedAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(imports);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me/shopify-import
// @desc    Get the logged-in vendor's Shopify connection + latest import status
// @access  Private (Vendor only)
router.get("/me/shopify-import", protect, async (req, res, next) => {
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

    const latestImport = await ShopifyImport.findOne({ vendor: vendor._id }).sort({
      createdAt: -1,
    });

    res.json({
      shopify: vendor.shopify,
      import: latestImport,
    });
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

// @route   POST /api/vendors/admin/onboard
// @desc    Admin: Create a vendor account on a brand's behalf, skipping the
//          application/approval flow, and email them a link to claim it
// @access  Private (Admin Only)
router.post("/admin/onboard", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    const { name, email, description, phone, website } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let user;
    let vendor;
    try {
      const createdUsers = await User.create(
        [{ name, email, role: "vendor", authProvider: "invited" }],
        { session },
      );
      user = createdUsers[0];

      const createdVendors = await Vendor.create(
        [{ name, email, description, phone, website, owner: user._id }],
        { session },
      );
      vendor = createdVendors[0];

      await session.commitTransaction();
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

    // Reuse the forgot-password token pattern (see /api/auth/forgot-password) so
    // the vendor claims their account through the existing reset-password page,
    // just with a longer expiry since this isn't a time-sensitive security reset.
    const claimToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(claimToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await user.save();

    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
    const claimUrl = `${frontendUrl}/reset-password/${claimToken}`;

    await sendEmail({
      email: user.email,
      subject: "DRYP: Your Studio Account Is Ready",
      message: `A DRYP studio account has been created for ${name}. Set your password to claim it: ${claimUrl}`,
    });

    res.status(201).json({ vendor });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/vendors/admin/catalog-preview
// @desc    Admin: Parse an uploaded spreadsheet into draft products for review
// @access  Private (Admin Only)
router.post(
  "/admin/catalog-preview",
  protect,
  catalogUploadSingle,
  async (req, res, next) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Admins only." });

      if (!req.file) {
        return res
          .status(400)
          .json({ message: "No file uploaded (expected field name 'file')." });
      }

      const rows = await parseCatalogFile(req.file.buffer, req.file.originalname);
      const { products, skippedRows } = groupRowsIntoProducts(rows);
      res.json({ importId: null, products, skippedRows });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  },
);

// @route   POST /api/vendors/admin/:vendorId/catalog-import
// @desc    Admin: Commit reviewed products into a vendor's catalog
// @access  Private (Admin Only)
router.post("/admin/:vendorId/catalog-import", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    let products;
    if (req.body.importId) {
      const catalogImport = await CatalogImport.findById(req.body.importId);
      if (!catalogImport) {
        return res.status(400).json({ message: "Import session not found." });
      }
      products = catalogImport.products;
    } else {
      products = req.body.products;
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "No products to import." });
    }

    const ops = buildProductBulkOps(vendor, products);
    let imported = 0;
    for (let i = 0; i < ops.length; i += BULK_BATCH_SIZE) {
      const batch = ops.slice(i, i + BULK_BATCH_SIZE);
      await Product.bulkWrite(batch);
      imported += batch.length;
    }
    res.json({ imported });
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
