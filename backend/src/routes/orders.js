const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { identifyUser, protect } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order (or multiple if items from different vendors)
// @access  Public / Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { items, shippingAddress } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestId = req.guestId;

    if (!userId && !guestId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    if (!items || items.length === 0) return res.status(400).json({ message: 'No items in order' });
    
    const productIds = items.map(item => item.productId);
    const productsInCart = await Product.find({ '_id': { $in: productIds } }).select('vendor');
    const productVendorMap = productsInCart.reduce((acc, product) => {
      acc[product._id.toString()] = product.vendor;
      return acc;
    }, {});
    
    const ordersByVendor = items.reduce((acc, item) => {
      const vendorId = productVendorMap[item.productId];
      if (vendorId) {
        if (!acc[vendorId]) acc[vendorId] = [];
        acc[vendorId].push(item);
      }
      return acc;
    }, {});

    const createdOrders = [];
    for (const vendorId of Object.keys(ordersByVendor)) {
        const vendorItems = ordersByVendor[vendorId];
        const totalAmount = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const order = new Order({
            user: userId,
            guestId: guestId,
            items: vendorItems.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.price,
                size: item.options?.size,
                vendor: productVendorMap[item.productId],
            })),
            totalAmount,
            shippingAddress,
            status: 'pending',
            orderNumber: `DRYP-${Date.now()}-${createdOrders.length + 1}`
        });
        createdOrders.push(order.save());
    }
    
    const savedOrders = await Promise.all(createdOrders);
    res.status(201).json(savedOrders);
  } catch (error) { 
    console.error('Order creation error:', error);
    next(error); 
  }
});

// @route   GET /api/orders/mine
// @desc    Get logged in user's or guest's orders
// @access  Public / Private
router.get('/mine', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) {
      return res.json([]);
    }
    const orders = await Order.find(query)
      .populate({ path: 'items.product' })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) { next(error); }
});

// @route   GET /api/orders/vendor
// @desc    Get all orders for the logged-in vendor
// @access  Private (Vendor only)
router.get('/vendor', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'vendor') {
            return res.status(403).json({ message: 'Forbidden: Only vendors can access this route' });
        }
        const orders = await Order.find({ 'items.vendor': req.user._id })
            .populate('user', 'name email')
            .populate('items.product', 'name sku')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/orders/by-number/:orderNumber
// @desc    Get a single order by order number
// @access  Private
router.get('/by-number/:orderNumber', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate('items.product', 'name images brand');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'vendor') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json(order);
  } catch (error) { next(error); }
});

// @route   GET /api/orders/:id
// @desc    Get a single order by ID
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name images brand');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'vendor') {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json(order);
  } catch (error) { next(error); }
});

module.exports = router;