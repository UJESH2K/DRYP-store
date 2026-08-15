const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Razorpay = require('razorpay');
const Product = require('../models/Product');
const { decrementOrderStock } = require('../utils/orderStock');
let razorpayClient;
function getRazorpay() {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

router.post('/create-intent', protect, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found or unauthorized' });

    const rzp = getRazorpay();
    const razorpayOrder = await rzp.orders.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'INR',
      receipt: order.orderNumber,
      payment_capture: 1,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({ id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) { next(error); }
});

router.post('/verify', protect, async (req, res, next) => {
  try {
    const { razorpayOrderId, paymentId, signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(500).json({ message: 'Razorpay not configured' });

    const generated = crypto.createHmac('sha256', secret).update(razorpayOrderId + '|' + paymentId).digest('hex');
    const isVerified = generated === signature;

    if (!isVerified) {
      await Order.findOneAndUpdate({ razorpayOrderId }, { paymentStatus: 'failed' });
      return res.status(400).json({ verified: false, message: 'Invalid payment signature' });
    }

    // Idempotency: if this order was already confirmed by an earlier verify
    // (e.g. client retried after a network timeout), skip re-decrementing stock.
    const existing = await Order.findOne({ razorpayOrderId });
    if (existing && existing.paymentStatus === 'completed') {
      return res.json({ verified: true, message: 'Payment successful', alreadyConfirmed: true });
    }

    const order = await Order.findOneAndUpdate(
      { razorpayOrderId, paymentStatus: { $ne: 'completed' } },
      { paymentStatus: 'completed', status: 'confirmed', razorpayPaymentId: paymentId, razorpaySignature: signature },
      { new: true }
    );

    if (order) {
      await decrementOrderStock(order);
    }

    res.json({ verified: true, message: 'Payment successful' });
  } catch (error) { next(error); }
});

module.exports = router;


