const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/vendors/register
// @desc    Register a new vendor and user
// @access  Public
router.post('/register', async (req, res, next) => {
  const {
    ownerName,
    email,
    password,
    vendorName,
    description,
    phone,
    website,
    address,
  } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user with vendor role
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: ownerName,
      email,
      passwordHash,
      role: 'vendor',
    });

    // Create new vendor linked to the user
    const vendor = await Vendor.create({
      name: vendorName,
      email,
      description,
      owner: user._id,
      address,
      phone,
      website,
    });

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user, vendor });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/vendors/me/products
// @desc    Get all products for the logged-in vendor
// @access  Private (Vendor only)
router.get('/me/products', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can access this route' });
    }

    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found for this user' });
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
router.get('/me', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can access this route' });
    }
    console.log('Searching for vendor with owner ID:', req.user._id);
    const vendor = await Vendor.findOne({ owner: req.user._id });
    console.log('Found vendor:', vendor);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found for this user' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/vendors/me
// @desc    Update the logged-in vendor's profile
// @access  Private (Vendor only)
router.put('/me', protect, async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Forbidden: Only vendors can access this route' });
    }
    const vendor = await Vendor.findOneAndUpdate(
      { owner: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found for this user' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (error) { next(error); }
});

// GET /api/vendors/:id/products
router.get('/:id/products', async (req, res, next) => {
  try {
    const products = await Product.find({ vendor: req.params.id, isActive: true });
    res.json(products);
  } catch (error) { next(error); }
});

module.exports = router;


