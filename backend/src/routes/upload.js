const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireVendor } = require('../middleware/requireRole');
const storage = require('../utils/storageProvider');

const router = express.Router();

// Ensure the uploads directory exists (used by the local-disk
// storage backend; harmless in S3 mode).
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Phase 2A: memory storage so we can route the buffer to either the
// local disk or S3 via the storageProvider.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb('Error: Images Only!');
  },
}).single('image');

// @route   POST /api/upload
// @desc    Upload an image. Routes the buffer to local disk or S3
//          based on STORAGE_PROVIDER env. Returns a public URL.
// @access  Private (Vendor only)
router.post('/', requireVendor, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: typeof err === 'string' ? err : err.message });
    if (!req.file) return res.status(400).json({ message: 'Error: No File Selected!' });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const key = `image-${uniqueSuffix}${path.extname(req.file.originalname)}`;

    const result = await storage.put(req.file.buffer, key, req.file.mimetype);
    if (!result.ok) {
      return res.status(502).json({ message: 'Storage provider failed: ' + result.error });
    }

    res.status(200).json({
      message: 'Image Uploaded Successfully!',
      url: result.url,
      key: result.key,
      provider: result.provider,
    });
  });
});

module.exports = router;