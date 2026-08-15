const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { identifyUser } = require("../middleware/auth");
const { signProductImages } = require("../utils/imageUrls");

const generateCartId = (productId, options) => {
  // item.options is a Mongoose Map once hydrated — Object.entries(map) yields
  // only internal $__* keys, so normalize via fromEntries (Map iterates real
  // entries) and fall back to a plain object for callers that pass one.
  const optMap =
    options instanceof Map ? Object.fromEntries(options) : options || {};
  const entries = Object.entries(optMap)
    .filter(([k]) => k !== '_id' && k !== 'id')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}-${v}`);
  // No trailing '_' for options-less items — the client generates the bare
  // productId for those, so DELETE/PUT/merge must agree.
  return productId.toString() + (entries.length ? `_${entries.join('_')}` : '');
};

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

router.get("/", identifyUser, async (req, res) => {
  try {
    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.json([]);
    }
    await cart.populate("items.product");
    for (const item of cart.items) {
      if (item.product) {
        item.product = await signProductImages(item.product);
      }
    }
    res.json(cart.items);
  } catch (error) {
    console.error("Error getting cart:", error.message);
    res.status(500).send("Server Error");
  }
});

router.post("/", identifyUser, async (req, res) => {
  try {
    const { productId, quantity, price, options } = req.body;

    let sanitizedOptions = {};
    // The client sends option names as stored on the product (e.g. Size, Color).
    // Compare case-insensitively but preserve the client's casing — "Size" /
    // "Color" are the canonical keys used downstream by cartId generation,
    // orders.js variant matching and payments.js stock decrement.
    const ALLOWED_KEYS = ['size', 'color', 'material', 'style', 'fit'];
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      for (const [key, value] of Object.entries(options)) {
        const normalized = key.toLowerCase();
        if (ALLOWED_KEYS.includes(normalized) && value !== undefined && value !== null) {
          const val = String(value).trim();
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

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const safeQty = Math.max(1, parseInt(quantity, 10) || 1);

    // Pass the sanitized options to your ID generator
    const incomingCartId = generateCartId(productId, sanitizedOptions);

    const cartItemIndex = cart.items.findIndex(
      (item) => generateCartId(item.product, item.options) === incomingCartId,
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity += safeQty;
    } else {
      cart.items.push({
        product: productId,
        quantity: safeQty,
        price,
        options: sanitizedOptions, // <-- Save the clean, validated data!
      });
    }

    // Tell Mongoose EXPLICITLY that the array changed
    cart.markModified("items");
    await cart.save();

    await cart.populate("items.product");
    for (const item of cart.items) {
      if (item.product) {
        item.product = await signProductImages(item.product);
      }
    }
    res.json(cart.items);
  } catch (error) {
    console.error("Error adding to cart:", error.message);
    res.status(500).send("Server Error");
  }
});

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
    for (const item of cart.items) {
      if (item.product) {
        item.product = await signProductImages(item.product);
      }
    }
    res.json(cart.items);
  } catch (error) {
    console.error("Error removing from cart:", error.message);
    res.status(500).send("Server Error");
  }
});

router.put("/:cartItemId", identifyUser, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const safeQty = Math.max(1, parseInt(quantity, 10) || 1);

    const cart = await getOrCreateCart(req);
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => generateCartId(item.product, item.options) === cartItemId,
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity = safeQty;
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Tell Mongoose EXPLICITLY that the array changed
    cart.markModified("items");
    await cart.save();

    await cart.populate("items.product");
    for (const item of cart.items) {
      if (item.product) {
        item.product = await signProductImages(item.product);
      }
    }
    res.json(cart.items);
  } catch (error) {
    console.error("Error updating cart item:", error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
