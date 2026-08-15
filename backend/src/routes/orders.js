const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { identifyUser, protect } = require('../middleware/auth');
const router = express.Router();
const Cart = require('../models/Cart');


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
    if (items.length > 100) {
      return res.status(400).json({ message: 'Too many items in order' });
    }
    
    const productIds = items.map(item => item.productId);
    const productsInCart = await Product.find({ '_id': { $in: productIds }, isActive: true });
    
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
      let matchedVariant = null;

      // Cart options use the product's option names (e.g. { Size: 'M', Color: 'Black' }),
      // and variant.options is a Mongoose Map — dot access returns undefined, so use .get().
      // Match on every selected option so variants keyed by something other than Size
      // (e.g. Waist+Color) resolve their real price and stock. Variants are _id:false,
      // so identity is the variant's sku (unique, sparse).
      const itemOptions = (item.options && typeof item.options === 'object') ? item.options : {};
      if (Object.keys(itemOptions).length > 0 && dbProduct.variants && dbProduct.variants.length > 0) {
        matchedVariant = dbProduct.variants.find(v =>
          Object.keys(itemOptions).every(k => v.options.get(k) === itemOptions[k])
        );
        if (matchedVariant && matchedVariant.price) {
          truePrice = matchedVariant.price;
        }
      }

      const safeQty = Math.max(1, parseInt(item.quantity) || 1);

      // Reject orders that exceed available stock so a paid order can never
      // exceed what the warehouse can ship (stock is decremented on payment).
      const stockAvailable = matchedVariant ? matchedVariant.stock : dbProduct.stock;
      if (safeQty > stockAvailable) {
        const stockErr = new Error(`Insufficient stock for "${dbProduct.name}" (${stockAvailable} available).`);
        stockErr.status = 400;
        throw stockErr;
      }

      if (!acc[vendorId]) acc[vendorId] = [];
      
      acc[vendorId].push({
          productId: item.productId,
          quantity: safeQty,
          price: truePrice, 
          size: item.options?.Size,
          variantKey: matchedVariant ? (matchedVariant.sku || matchedVariant.options.get('Size')) : null,
          vendorId: vendorId
      });
      
      return acc;
    }, {});

    const createdOrders = [];
    for (const vendorId of Object.keys(ordersByVendor)) {
        const vendorItems = ordersByVendor[vendorId];
        
        const subtotal = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Same pricing rules the checkout screen displays: free shipping over
        // $75, 8% tax. Charged via totalAmount so users pay what they see.
        const shippingCost = subtotal > 75 ? 0 : 9.99;
        const tax = Math.round(subtotal * 0.08 * 100) / 100;
        const totalAmount = Math.round((subtotal + shippingCost + tax) * 100) / 100;

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
                variantKey: item.variantKey,
                vendor: item.vendorId,
            })),
            subtotal,
            shippingCost,
            tax,
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

    res.status(201).json(savedOrders);
  } catch (error) { 
    console.error('Order creation error:', error);
    if (error && error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error); 
  }
});

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

router.get('/by-number/:orderNumber', identifyUser, async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate('items.product', 'name images brand');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const isOwner = !!order.user && !!req.user && order.user.toString() === req.user._id.toString();
    // Guest checkouts have no account: the order's guestId is the bearer
    // secret (random, persisted app-side), so matching it authorizes the
    // confirmation screen without leaking orders to strangers.
    const isGuestOwner = !order.user && !!order.guestId && !!req.guestId && order.guestId === req.guestId;
    // Vendors may only read orders that contain their own items (cross-tenant
    // PII would leak otherwise).
    const isVendorOnOrder = !!req.user && req.user.role === 'vendor' && order.items.some(i => i.vendor.toString() === req.user._id.toString());
    if (!isOwner && !isGuestOwner && !isVendorOnOrder) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json(order);
  } catch (error) { next(error); }
});

router.get('/:id', identifyUser, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const order = await Order.findById(req.params.id).populate('items.product', 'name images brand');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const isOwner = !!order.user && !!req.user && order.user.toString() === req.user._id.toString();
    const isGuestOwner = !order.user && !!order.guestId && !!req.guestId && order.guestId === req.guestId;
    const isVendorOnOrder = !!req.user && req.user.role === 'vendor' && order.items.some(i => i.vendor.toString() === req.user._id.toString());
    if (!isOwner && !isGuestOwner && !isVendorOnOrder) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json(order);
  } catch (error) { next(error); }
});

module.exports = router;