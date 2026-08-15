const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Order = require('../models/Order');
const { decrementOrderStock } = require('../utils/orderStock');

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  if (!secret) {
    // Refuse to process webhooks when signature verification is disabled —
    // otherwise forged events could mark orders as paid.
    console.error('RAZORPAY_WEBHOOK_SECRET not set; refusing webhook');
    return res.status(503).json({ message: 'Webhook signature verification not configured' });
  }
  if (!signature) {
    return res.status(400).json({ message: 'Missing x-razorpay-signature' });
  }
  const generated = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if (generated !== signature) return res.status(400).json({ message: 'Invalid signature' });
  try {
    const event = JSON.parse(req.body);
    const payment = event.payload && event.payload.payment && event.payload.payment.entity;
    if (event.event === 'payment.captured' && payment) {
      // Idempotent: only the transition pending->completed decrements stock.
      const order = await Order.findOneAndUpdate(
        { razorpayOrderId: payment.order_id, paymentStatus: { $ne: 'completed' } },
        { paymentStatus: 'completed', status: 'confirmed', razorpayPaymentId: payment.id },
        { new: true }
      );
      if (order) await decrementOrderStock(order);
    } else if (event.event === 'payment.failed' && payment) {
      await Order.findOneAndUpdate({ razorpayOrderId: payment.order_id }, { paymentStatus: 'failed' });
    }
    res.json({ received: true });
  } catch (e) {
    res.status(400).json({ message: 'Webhook processing failed' });
  }
});

module.exports = router;
