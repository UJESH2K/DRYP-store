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
const GoogleRegistrationDraft = require("../models/GoogleRegistrationDraft");
const ShopifyImport = require("../models/ShopifyImport");
const CatalogImport = require("../models/CatalogImport");
const sendEmail = require("../utils/sendEmail");
const {
  parseCatalogFile,
  groupRowsIntoProducts,
  buildProductBulkOps,
  normalizeAiProducts,
  safeStr,
} = require("../utils/catalogImport");
const { parseCatalogFileStream } = require("../utils/catalogImportStream");
const { signProductImages } = require("../utils/imageUrls");
const { isValidPassword } = require("./auth");
const { createPasswordToken } = require("../utils/passwordTokens");
const MAX_CATALOG_FILE_SIZE_MB = 500;
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

router.post("/apply", async (req, res, next) => {
  try {
    const { studioName, email, websiteOrPortfolio } = req.body;
    const contactEmail = String(email || "").toLowerCase().trim();

    if (!studioName || !contactEmail || !websiteOrPortfolio) {
      return res.status(400).json({
        message: "Studio name, contact email, and portfolio URL are required.",
      });
    }

    const existingUser = await User.findOne({ email: contactEmail });
    if (existingUser && existingUser.isActive === false) {
      return res.status(403).json({ message: "This account is suspended." });
    }
    if (existingUser && ["vendor", "admin"].includes(existingUser.role))
      return res.status(400).json({ message: "Email is already registered." });

    const existingApp = await VendorApplication.findOne({
      $or: [
        { email: contactEmail },
        { googleEmail: contactEmail },
        { verifiedGoogleEmail: contactEmail },
      ],
    });
    if (existingApp) {
      return res.status(400).json({
        message: `Your application is currently ${existingApp.status}.`,
      });
    }

    await VendorApplication.create({
      studioName,
      email: contactEmail,
      websiteOrPortfolio,
    });

    res
      .status(201)
      .json({
        message:
          "Application submitted successfully. We will review your dossier.",
      });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An application with this email already exists.",
      });
    }
    next(error);
  }
});

router.post("/google-registration-drafts", async (req, res, next) => {
  try {
    const { studioName, websiteOrPortfolio } = req.body;

    if (!studioName || !studioName.trim()) {
      return res.status(400).json({ message: "Studio name is required." });
    }
    if (!websiteOrPortfolio || !websiteOrPortfolio.trim()) {
      return res.status(400).json({ message: "Portfolio URL is required." });
    }

    let portfolioUrl;
    try {
      portfolioUrl = new URL(websiteOrPortfolio.trim());
    } catch {
      portfolioUrl = null;
    }
    if (!portfolioUrl || !["http:", "https:"].includes(portfolioUrl.protocol)) {
      return res.status(400).json({ message: "Portfolio must be a valid http(s) URL." });
    }

    const draftId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await GoogleRegistrationDraft.create({
      draftId,
      studioName: studioName.trim(),
      websiteOrPortfolio: websiteOrPortfolio.trim(),
      expiresAt,
    });

    res.status(201).json({ draftId });
  } catch (error) {
    next(error);
  }
});

//          Extracted from the route handler so the flow can be integration
//          tested without an HTTP server. `sendEmailFn` is injectable
//          (defaults to the real sender) so tests can capture the message
//          instead of dispatching real mail.
//
//          The whole decision runs inside a single MongoDB session
//          transaction: the application status flip, invited User
//          creation/upgrade, Vendor profile creation, and the hashed
//          one-time password setup token commit together or not at all.
//          If any write fails (e.g. a duplicate-key race on User.email or
//          Vendor.email), the transaction aborts and the application stays
//          pending. The notification email is sent only after a successful
//          commit.
// @returns {ok: true, application, user?, vendor?, passwordUrl?} on success,
//          or {ok: false, error: 'invalid_status' | 'not_found' | 'conflict'}.
async function processApplicationDecision({
  applicationId,
  status,
  adminId,
  sendEmailFn = sendEmail,
}) {
  if (!["approved", "rejected"].includes(status)) {
    return { ok: false, error: "invalid_status" };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await VendorApplication.findById(applicationId).session(
      session,
    );
    if (!application) {
      await session.abortTransaction();
      session.endSession();
      return { ok: false, error: "not_found" };
    }

    application.status = status;
    application.reviewedBy = adminId;
    application.reviewedAt = Date.now();
    await application.save({ session });

    const { frontendUrl } = require('../utils/frontendUrl');

    if (status === "approved") {
      const claimToken = createPasswordToken(7 * 24 * 60 * 60 * 1000);
      let user = await User.findOne({ email: application.email }).session(
        session,
      );

      if (!user) {
        const created = await User.create(
          [
            {
              name: application.studioName,
              email: application.email,
              authProvider: "invited",
              role: "vendor",
              resetPasswordToken: claimToken.hashedToken,
              resetPasswordExpire: claimToken.expiresAt,
            },
          ],
          { session },
        );
        user = created[0];
      } else {
        if (user.role === "user") user.role = "vendor";
        user.resetPasswordToken = claimToken.hashedToken;
        user.resetPasswordExpire = claimToken.expiresAt;
        await user.save({ session });
      }

      let vendor = null;
      if (user.role === "vendor") {
        vendor = await Vendor.findOne({ owner: user._id }).session(session);
        if (!vendor) {
          const created = await Vendor.create(
            [
              {
                name: application.studioName,
                email: application.email,
                owner: user._id,
              },
            ],
            { session },
          );
          vendor = created[0];
        }
      }

      await session.commitTransaction();
      session.endSession();

      const passwordUrl = `${frontendUrl()}/reset-password/${claimToken.rawToken}`;
      await sendEmailFn({
        email: application.email,
        subject: "DRYP: Studio Approved",
        message: `Your application has been accepted.\n\nSet your password securely here: ${passwordUrl}\n\nOr log in with Google after approval: ${frontendUrl()}/login\n\nThis password link expires in 7 days. After login you can upload products via Manual, Excel, or Shopify link.`,
      });

      return { ok: true, application, user, vendor, passwordUrl };
    }

    await session.commitTransaction();
    session.endSession();

    await sendEmailFn({
      email: application.email,
      subject: "DRYP: Application Status",
      message: `Thank you for your interest in DRYP. Unfortunately, your studio does not align with our current curation. We wish you the best.`,
    });

    return { ok: true, application };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // Transaction may already be aborted by the write error.
    }
    session.endSession();
    if (err && err.code === 11000) {
      // Duplicate-key race on a unique User/Vendor identity index. Nothing
      // was committed, so the application remains pending and can be
      // re-decided; report a generic non-enumerating conflict.
      return { ok: false, error: "conflict" };
    }
    throw err;
  }
}

router.put("/applications/:id", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only." });
    }

    const { status } = req.body; // 'approved' or 'rejected'
    const result = await processApplicationDecision({
      applicationId: req.params.id,
      status,
      adminId: req.user._id,
    });

    if (!result.ok) {
      if (result.error === "invalid_status") {
        return res.status(400).json({ message: "Invalid status update." });
      }
      if (result.error === "not_found") {
        return res.status(404).json({ message: "Application not found" });
      }
      if (result.error === "conflict") {
        return res
          .status(409)
          .json({ message: "Application conflicts with an existing account; no changes were saved." });
      }
      return next(new Error(`Unexpected decision error: ${result.error}`));
    }

    res.json({
      message: `Application ${status} successfully. Email dispatched.`,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/applications", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only." });

    const applications = await VendorApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();

  try {
    const application = await VendorApplication.findOne({
      $or: [{ email: normalizedEmail }, { googleEmail: normalizedEmail }],
      status: "approved",
    });
    if (!application) {
      return res.status(403).json({
        message:
          "Forbidden. Your email must be approved by DRYP administration before registering.",
      });
    }

    if (!password || !isValidPassword(password)) {
      return res.status(400).json({
        message: "Password must be 8+ characters with uppercase, lowercase, and numbers.",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      let user = await User.findOne({ email: application.email }).session(session);

      if (user) {
        user.name = user.name || name || application.studioName;
        user.passwordHash = passwordHash;
        user.authProvider = "local";
        if (user.role === "user") user.role = "vendor";
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ session });
      } else {
        const createdUsers = await User.create(
          [
            {
              name: name || application.studioName,
              email: application.email,
              passwordHash,
              authProvider: "local",
              role: "vendor",
            },
          ],
          { session },
        );
        user = createdUsers[0];
      }

      let vendor = await Vendor.findOne({ owner: user._id }).session(session);
      if (!vendor) {
        const createdVendors = await Vendor.create(
          [
            {
              name: `${name || application.studioName}'s Studio`,
              email: application.email,
              owner: user._id,
            },
          ],
          { session },
        );
        vendor = createdVendors[0];
      }

      await session.commitTransaction();
      session.endSession();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      const userObj = user.toObject();
      delete userObj.passwordHash;

      res.status(201).json({ token, user: userObj, vendor });
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
    const user = await User.findOne({ email }).select('+passwordHash');
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

    if (!user.passwordHash) {
      return res.status(403).json({
        message: "Set your studio password from the approval email before using email login.",
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

    const products = await Product.find({ vendor: req.user._id });
    res.json(await Promise.all(products.map((product) => signProductImages(product))));
  } catch (error) {
    next(error);
  }
});

router.get("/me", protect, async (req, res, next) => {
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
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

router.put("/me", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "vendor") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only vendors can access this route" });
    }
    const allowed = [
      "name",
      "description",
      "phone",
      "website",
      "logo",
      "address",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.address && typeof updates.address === "object") {
      const addrKeys = ["street", "city", "state", "zipCode", "country"];
      const address = {};
      for (const k of addrKeys) {
        if (updates.address[k] !== undefined) address[k] = updates.address[k];
      }
      updates.address = address;
    }
    const vendor = await Vendor.findOneAndUpdate(
      { owner: req.user._id },
      { $set: updates },
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

      // Files above STREAM_THRESHOLD use ExcelJS streaming reader — processes
      // rows one at a time so peak memory stays bounded regardless of file size.
      const STREAM_THRESHOLD = 5 * 1024 * 1024; // 5 MB
      const fileTooBig = req.file.size > STREAM_THRESHOLD;

      let products, skippedRows, parseErrors, droppedColumns;
      let parseMethod = 'rule_based';
      let aiSchema, aiError;
      let totalRowCount = 0;

      if (fileTooBig) {
        console.log(`[catalog-preview] large file (${(req.file.size/1024/1024).toFixed(2)}MB), using streaming parser`);
        const result = await parseCatalogFileStream(req.file.buffer, req.file.originalname);
        products = result.products;
        skippedRows = result.skippedRows;
        parseErrors = result.parseErrors;
        droppedColumns = result.droppedColumns;
        totalRowCount = result.totalRows;
        parseMethod = 'rule_based_streaming';
      } else {
        const { rows, errors, unknownHeaders, aiSchema: aiS, aiParsed, aiError: aiErr } = await parseCatalogFile(req.file.buffer, req.file.originalname);
        aiSchema = aiS;
        aiError = aiErr;

        // Prefer AI-parsed results when available; fall back to local grouper.
        if (aiParsed && aiParsed.products && aiParsed.products.length > 0) {
          products = normalizeAiProducts(aiParsed.products);
          skippedRows = aiParsed.skippedRows || [];
          parseErrors = aiParsed.parseErrors || [];
          parseMethod = 'ai_assisted';
        } else {
          const grouped = groupRowsIntoProducts(rows, errors);
          products = grouped.products;
          skippedRows = grouped.skippedRows;
          parseErrors = errors;
        }
        droppedColumns = unknownHeaders;
      }

      const catalogImport = await CatalogImport.create({
        vendor: vendor._id,
        status: "previewed",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        totalRows: products.reduce((sum, p) => sum + (p.variants?.length || 1), 0),
        skippedRows,
        products,
        parseErrors,
        aiSchema,
        error: droppedColumns.length > 0 ? `Unrecognized columns: ${droppedColumns.join(', ')}` : undefined,
      });

      res.json({ importId: catalogImport._id, products, skippedRows, parseErrors, droppedColumns, parseMethod, aiError });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  },
);

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
    const vendor = await Vendor.findById(req.params.id).select("owner");
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    const products = await Product.find({
      vendor: vendor.owner,
      isActive: true,
    });
    res.json(await Promise.all(products.map((product) => signProductImages(product))));
  } catch (error) {
    next(error);
  }
});

//          application/approval flow, and email them a link to claim it
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

    const { frontendUrl } = require('../utils/frontendUrl');
    const claimUrl = `${frontendUrl()}/reset-password/${claimToken}`;

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

      const STREAM_THRESHOLD = 5 * 1024 * 1024; // 5 MB
      const fileTooBig = req.file.size > STREAM_THRESHOLD;

      let products, skippedRows;
      let droppedColumns;

      if (fileTooBig) {
        const result = await parseCatalogFileStream(req.file.buffer, req.file.originalname);
        products = result.products;
        skippedRows = result.skippedRows;
        droppedColumns = result.droppedColumns;
      } else {
        const { rows, errors, unknownHeaders, aiParsed, aiError } = await parseCatalogFile(req.file.buffer, req.file.originalname);
        droppedColumns = unknownHeaders;
        if (aiParsed && aiParsed.products && aiParsed.products.length > 0) {
          products = normalizeAiProducts(aiParsed.products);
          skippedRows = aiParsed.skippedRows || [];
        } else {
          const grouped = groupRowsIntoProducts(rows, errors);
          products = grouped.products;
          skippedRows = grouped.skippedRows;
        }
      }
      res.json({ importId: null, products, skippedRows, droppedColumns, aiError });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  },
);

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
module.exports.processApplicationDecision = processApplicationDecision;
