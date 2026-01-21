const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { identifyUser } = require('../middleware/auth');

// Helper function to find or create a cart
const getOrCreateCart = async (req) => {
    let cart;
    const findCartQuery = req.user ? { user: req.user.id } : { guestId: req.guestId };

    if (req.user || req.guestId) {
        cart = await Cart.findOne(findCartQuery);
    }

    if (!cart && (req.user || req.guestId)) {
        cart = new Cart(findCartQuery);
        await cart.save();
    }
    return cart;
};


// @route   GET /api/cart
// @desc    Get user's or guest's cart
// @access  Public
router.get('/', identifyUser, async (req, res) => {
    try {
        const cart = await getOrCreateCart(req);
        if (!cart) {
            return res.json([]);
        }
        await cart.populate('items.product');
        res.json(cart.items);
    } catch (error) {
        console.error('Error getting cart:', error.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/cart
// @desc    Add an item to the cart
// @access  Public
router.post('/', identifyUser, async (req, res) => {
    try {
        const { productId, quantity, price, options } = req.body;

        const cart = await getOrCreateCart(req);
        if (!cart) {
            return res.status(400).json({ message: 'Could not establish a cart session.' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const cartItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (cartItemIndex > -1) {
            cart.items[cartItemIndex].quantity += quantity || 1;
        } else {
            cart.items.push({ product: productId, quantity: quantity || 1, price, options });
        }

        await cart.save();
        await cart.populate('items.product');
        res.json(cart.items);
    } catch (error) {
        console.error('Error adding to cart:', error.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/cart/:productId
// @desc    Remove an item from the cart
// @access  Public
router.delete('/:productId', identifyUser, async (req, res) => {
    try {
        const { productId } = req.params;
        
        const cart = await getOrCreateCart(req);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);

        await cart.save();
        await cart.populate('items.product');
        res.json(cart.items);
    } catch (error) {
        console.error('Error removing from cart:', error.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/cart/:productId
// @desc    Update item quantity in the cart
// @access  Public
router.put('/:productId', identifyUser, async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be at least 1' });
        }

        const cart = await getOrCreateCart(req);
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (cartItemIndex > -1) {
            cart.items[cartItemIndex].quantity = quantity;
        } else {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        await cart.save();
        await cart.populate('items.product');
        res.json(cart.items);
    } catch (error) {
        console.error('Error updating cart item:', error.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
