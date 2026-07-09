const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { identifyUser } = require("../middleware/auth");

const generateCartId = (productId, options) =>
  productId.toString() + (options ? '_' + Object.entries(options).filter(([k]) => k !== '_id' && k !== 'id').sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => k + '-' + v).join('_') : '');

// Helper function to find or create a cart
const getOrCreateCart = async (req) => {
  let cart;
  const findCartQuery = req.user
    ? { user: req.user.id }
    : { guestId: req.guestId };

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
router.get("/", identifyUser, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.json([]);
    }
    await cart.populate("items.product");
    res.json(cart.items);
  } catch (error) {
    console.error("Error getting cart:", error.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST /api/cart
router.post("/", identifyUser, async (req, res) => {
  try {
    const { productId, quantity, price, options } = req.body;

    let sanitizedOptions = {};
    const ALLOWED_KEYS = ['size', 'color', 'material', 'style', 'fit'];
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      for (const key of ALLOWED_KEYS) {
        if (options[key] !== undefined) {
          const val = String(options[key]).trim();
          if (val.length > 0 && val.length <= 50) sanitizedOptions[key] = val;
        }
      }
    } else if (options) {
      return res.status(400).json({ message: "Invalid options format." });
    }

    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res
        .status(400)
        .json({ message: "Could not establish a cart session." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Pass the sanitized options to your ID generator
    const incomingCartId = generateCartId(productId, sanitizedOptions);

    const cartItemIndex = cart.items.findIndex(
      (item) => generateCartId(item.product, item.options) === incomingCartId,
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity += quantity || 1;
    } else {
      cart.items.push({
        product: productId,
        quantity: quantity || 1,
        price,
        options: sanitizedOptions, // <-- Save the clean, validated data!
      });
    }

    // Tell Mongoose EXPLICITLY that the array changed
    cart.markModified("items");
    await cart.save();

    await cart.populate("items.product");
    res.json(cart.items);
  } catch (error) {
    console.error("Error adding to cart:", error.message);
    res.status(500).send("Server Error");
  }
});

// @route   DELETE /api/cart/:cartItemId
router.delete("/:cartItemId", identifyUser, async (req, res) => {
  try {
    const { cartItemId } = req.params;

    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => generateCartId(item.product, item.options) !== cartItemId,
    );

    // Tell Mongoose EXPLICITLY that the array changed
    cart.markModified("items");
    await cart.save();

    await cart.populate("items.product");
    res.json(cart.items);
  } catch (error) {
    console.error("Error removing from cart:", error.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/cart/:cartItemId
router.put("/:cartItemId", identifyUser, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => generateCartId(item.product, item.options) === cartItemId,
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity = quantity;
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Tell Mongoose EXPLICITLY that the array changed
    cart.markModified("items");
    await cart.save();

    await cart.populate("items.product");
    res.json(cart.items);
  } catch (error) {
    console.error("Error updating cart item:", error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
