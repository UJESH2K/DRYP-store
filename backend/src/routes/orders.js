const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { identifyUser, protect } = require('../middleware/auth');
const router = express.Router();
const Cart = require('../models/Cart');


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
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }
    
    const productIds = items.map(item => item.productId);
    const productsInCart = await Product.find({ '_id': { $in: productIds } });
    
    if (productsInCart.length !== new Set(productIds).size) {
        return res.status(400).json({ message: 'One or more items in your cart are no longer available.' });
    }

    const productMap = productsInCart.reduce((acc, product) => {
      acc[product._id.toString()] = product;
      return acc;
    }, {});
    
    const ordersByVendor = items.reduce((acc, item) => {
      const dbProduct = productMap[item.productId];
      const vendorId = dbProduct.vendor.toString();

      let truePrice = dbProduct.basePrice;
      
      if (item.options && item.options.size && dbProduct.variants && dbProduct.variants.length > 0) {
         const matchedVariant = dbProduct.variants.find(v => 
            v.options && v.options.Size === item.options.size
         );
         if (matchedVariant && matchedVariant.price) {
             truePrice = matchedVariant.price;
         }
      }

      const safeQty = Math.max(1, parseInt(item.quantity) || 1);

      if (!acc[vendorId]) acc[vendorId] = [];
      
      acc[vendorId].push({
          productId: item.productId,
          quantity: safeQty,
          price: truePrice, 
          size: item.options?.size,
          vendorId: vendorId
      });
      
      return acc;
    }, {});

    const createdOrders = [];
    for (const vendorId of Object.keys(ordersByVendor)) {
        const vendorItems = ordersByVendor[vendorId];
        
        const totalAmount = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const uniqueString = crypto.randomUUID().split('-')[0].toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        const orderNumber = `DRYP-${uniqueString}-${timestamp}`;

        const order = new Order({
            user: userId,
            guestId: guestId,
            items: vendorItems.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.price, 
                size: item.size,
                vendor: item.vendorId,
            })),
            totalAmount,
            shippingAddress,
            status: 'pending',
            orderNumber: orderNumber
        });
        createdOrders.push(order.save());
    }
    
    const savedOrders = await Promise.all(createdOrders);

    const cartQuery = userId ? { user: userId } : { guestId: guestId };
    await Cart.findOneAndUpdate(cartQuery, { $set: { items: [] } });

    for (const item of items) {
      const quantityToDeduct = Math.abs(parseInt(item.quantity) || 1); // Ensure it's a positive number
      
      if (item.options && item.options.size) {
        await Product.updateOne(
          { _id: item.productId, "variants.options.Size": item.options.size },
          { $inc: { "variants.$.stock": -quantityToDeduct } }
        );
      } else {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stock: -quantityToDeduct } }
        );
      }
    }
    
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