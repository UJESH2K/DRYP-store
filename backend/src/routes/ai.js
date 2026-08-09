const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const ChatSession = require('../models/ChatSession');
const { generateEmbedding, generateProductEmbedding } = require('../utils/embeddings');
const { buildUserProfile, buildTasteVector, scoreProduct } = require('../utils/feedRanking');
const { identifyUser, protect } = require('../middleware/auth');
const SYSTEM_PROMPT = `You are a knowledgeable fashion assistant for DRYP, a clothing store. You help users find products, answer questions about the catalog, and make personalized recommendations.

When you recommend or mention products, always include their name, brand, and price. Be concise but helpful.

If the user asks about products you don't have in your search results, honestly say you don't have that information.

Current time and date: ${new Date().toISOString()}`;

// OpenAI function-calling tools exposed to the chat model
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the active product catalog with an optional text query and brand/category/price filters. Returns top matching products as a JSON array.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search terms (matched against name, description, brand, category, tags)' },
          brand: { type: 'string', description: 'Exact brand name to filter by' },
          category: { type: 'string', description: 'Exact category to filter by' },
          minPrice: { type: 'number', description: 'Minimum base price' },
          maxPrice: { type: 'number', description: 'Maximum base price' },
          limit: { type: 'number', description: 'Maximum results to return (default 5, max 10)' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description: 'Check the availability of a product by ID. Returns the product name, its options, and variant-level stock.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'MongoDB ObjectId of the product' },
        },
        required: ['productId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: "Add a product to the user's cart. Requires a signed-in user or guest session; returns an error otherwise.",
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'MongoDB ObjectId of the product' },
          quantity: { type: 'number', description: 'Quantity to add (default 1)' },
        },
        required: ['productId'],
        additionalProperties: false,
      },
    },
  },
];

// Cart line ID generation — mirrors backend/src/routes/cart.js exactly
const generateCartId = (productId, options) =>
  productId.toString() + (options ? '_' + Object.entries(options).filter(([k]) => k !== '_id' && k !== 'id').sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => k + '-' + v).join('_') : '');

// POST /api/ai/chat — Chat with the AI about products
router.post('/chat', identifyUser, async (req, res) => {
  try {
    const { messages, vendorId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Messages array is required' });
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      return res.status(400).json({ message: 'At least one user message is required' });
    }

    // Identity from identifyUser (was previously unused)
    const userId = req.user?._id;
    const guestId = req.guestId;

    // One chat session per user/guest identity. The client re-sends its full
    // local history every request, so only the latest user message is appended —
    // and only when it differs from the last stored user message (dedupe).
    let session = null;
    if (userId || guestId) {
      const sessionQuery = userId ? { user: userId } : { guestId };
      session = await ChatSession.findOne(sessionQuery);
      if (!session) {
        session = new ChatSession(sessionQuery);
      }
      const lastStoredUser = [...session.messages].reverse().find(m => m.role === 'user');
      if (!lastStoredUser || lastStoredUser.content !== lastUserMessage.content) {
        session.messages.push({ role: 'user', content: lastUserMessage.content });
      }
    }

    // Generate embedding for the last user message
    const queryEmbedding = await generateEmbedding(lastUserMessage.content);

    // Build vector search pipeline
    const matchStage = { $vectorSearch: {
      index: 'product_embeddings',
      path: 'embedding',
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10,
    }};

    const pipeline = [
      matchStage,
      {
        $match: { isActive: true }
      },
      {
        $project: {
          name: 1,
          description: 1,
          brand: 1,
          category: 1,
          basePrice: 1,
          images: { $slice: ['$images', 1] },
          tags: 1,
          source: 1,
          externalId: 1,
          embedding: 1,
          score: { $meta: 'vectorSearchScore' },
        }
      }
    ];

    // If vendorId is provided, filter by vendor
    if (vendorId) {
      pipeline.splice(1, 0, { $match: { vendor: require('mongoose').Types.ObjectId(vendorId) } });
    }

    const products = await Product.aggregate(pipeline);

    // If no products found with vector search, fall back to text search
    let productContext = '';
    let foundProducts = products;

    if (products.length === 0) {
      // Fallback: simple text regex search
      const words = lastUserMessage.content.split(/\s+/).filter(w => w.length > 2);
      const textSearchPipeline = words.length > 0 ? [
        {
          $match: {
            isActive: true,
            $or: words.map(w => ({
              $or: [
                { name: { $regex: w, $options: 'i' } },
                { description: { $regex: w, $options: 'i' } },
                { brand: { $regex: w, $options: 'i' } },
                { category: { $regex: w, $options: 'i' } },
                { tags: { $regex: w, $options: 'i' } },
              ]
            }))
          }
        },
        { $limit: 10 },
        {
          $project: {
            name: 1, description: 1, brand: 1, category: 1,
            basePrice: 1, images: { $slice: ['$images', 1] }, tags: 1,
            source: 1, externalId: 1, embedding: 1,
          }
        }
      ] : [];

      if (textSearchPipeline.length > 0) {
        if (vendorId) {
          textSearchPipeline.splice(1, 0, { $match: { vendor: require('mongoose').Types.ObjectId(vendorId) } });
        }
        foundProducts = await Product.aggregate(textSearchPipeline);
      }
    }

    // Profile-aware re-ranking: boost retrieval results that match the user's
    // taste profile. Anonymous users and signal-less profiles keep original order.
    let profile = null;
    if (userId || guestId) {
      profile = await buildUserProfile(userId, guestId);
      // Attach identity so buildTasteVector can re-query events (feed.js pattern)
      profile._userId = userId;
      profile._guestId = guestId;
      profile.tasteVector = await buildTasteVector(profile);
    }

    const hasProfileSignals = profile && (
      profile.preferences != null ||
      profile.preferredBrands.size > 0 ||
      profile.preferredCategories.size > 0 ||
      profile.preferredColors.size > 0 ||
      profile.likedBrands.size > 0 ||
      profile.likedCategories.size > 0 ||
      profile.likedColors.size > 0 ||
      profile.avgPrice != null
    );

    const usedVectorSearch = products.length > 0;
    if (hasProfileSignals && foundProducts.length > 0) {
      if (usedVectorSearch) {
        // Combined score: 0.5 * normalizedVectorScore + 0.5 * profileScore
        const maxScore = Math.max(...foundProducts.map(p => p.score || 0));
        if (maxScore > 0) {
          foundProducts = foundProducts
            .map(p => {
              const normalizedVectorScore = Math.min(1, Math.max(0, (p.score || 0) / maxScore));
              const profileScore = scoreProduct(p, profile);
              return { ...p, _combinedScore: 0.5 * normalizedVectorScore + 0.5 * profileScore };
            })
            .sort((a, b) => b._combinedScore - a._combinedScore);
        }
        // maxScore === 0: keep vector order only
      } else {
        // Text-fallback results carry no score: sort by profile score desc
        foundProducts = foundProducts
          .map(p => ({ ...p, _profileScore: scoreProduct(p, profile) }))
          .sort((a, b) => b._profileScore - a._profileScore);
      }
    }

    if (foundProducts.length > 0) {
      productContext = 'Here are the relevant products from our catalog:\n' +
        foundProducts.map((p, i) =>
          `${i + 1}. ${p.name} — ${p.brand} — $${p.basePrice}${p.description ? `\n   ${p.description.substring(0, 150)}` : ''}`
        ).join('\n\n');
    } else {
      productContext = 'No matching products found in the catalog.';
    }

    // Tool implementations
    const searchProductsTool = async (args = {}) => {
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      const match = { isActive: true };
      if (typeof args.query === 'string' && args.query.trim()) {
        const words = args.query.trim().split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          match.$or = words.map(w => ({
            $or: [
              { name: { $regex: w, $options: 'i' } },
              { description: { $regex: w, $options: 'i' } },
              { brand: { $regex: w, $options: 'i' } },
              { category: { $regex: w, $options: 'i' } },
              { tags: { $regex: w, $options: 'i' } },
            ],
          }));
        }
      }
      if (args.brand) match.brand = args.brand;
      if (args.category) match.category = args.category;
      const minPrice = Number(args.minPrice);
      const maxPrice = Number(args.maxPrice);
      if (!Number.isNaN(minPrice)) match.basePrice = { ...(match.basePrice || {}), $gte: minPrice };
      if (!Number.isNaN(maxPrice)) match.basePrice = { ...(match.basePrice || {}), $lte: maxPrice };

      const results = await Product.find(match).limit(limit).lean();
      return results.map(p => ({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        basePrice: p.basePrice,
        description: p.description ? p.description.substring(0, 200) : '',
        tags: p.tags || [],
        image: p.images && p.images[0] ? p.images[0] : null,
      }));
    };

    const checkStockTool = async (productId) => {
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return { error: 'Invalid product ID' };
      }
      const product = await Product.findById(productId).lean();
      if (!product) return { error: 'Product not found' };
      return {
        name: product.name,
        brand: product.brand,
        basePrice: product.basePrice,
        stock: product.stock != null ? product.stock : null,
        options: (product.options || []).map(o => ({ name: o.name, values: o.values })),
        variants: (product.variants || []).map(v => ({
          options: v.options,
          sku: v.sku,
          stock: v.stock,
          price: v.price,
        })),
      };
    };

    const addToCartTool = async (productId, quantity) => {
      if (!userId && !guestId) return { error: 'Sign-in required' };
      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return { error: 'Invalid product ID' };
      }
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const cartQuery = userId ? { user: userId } : { guestId };
      let cart = await Cart.findOne(cartQuery);
      if (!cart) cart = new Cart(cartQuery);

      const product = await Product.findById(productId);
      if (!product) return { error: 'Product not found' };

      // Reuse the exact cart-upsert logic from backend/src/routes/cart.js
      const incomingCartId = generateCartId(productId, {});
      const cartItemIndex = cart.items.findIndex(
        (item) => generateCartId(item.product, item.options) === incomingCartId,
      );
      if (cartItemIndex > -1) {
        cart.items[cartItemIndex].quantity += qty;
      } else {
        cart.items.push({ product: productId, quantity: qty, price: product.basePrice, options: {} });
      }
      cart.markModified('items');
      await cart.save();

      const cartItemCount = cart.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      return { success: true, cartItemCount };
    };

    // Generate AI response
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Stored session history when available; else the client's last 6 (backward compat)
    const llmMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(session
        ? session.messages.slice(-12).map(m => ({ role: m.role, content: m.content }))
        : messages.slice(-6)),
      { role: 'system', content: `Relevant catalog products:\n${productContext}` },
    ];

    let reply = '';
    let finalMessage = null;
    let toolSearchResults = [];

    // Tool-call loop (max 4 rounds to prevent infinite loops)
    for (let round = 0; round < 4; round++) {
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: llmMessages,
        max_tokens: 500,
        temperature: 0.7,
        tools,
      });

      finalMessage = completion.choices[0].message;
      if (!finalMessage.tool_calls || finalMessage.tool_calls.length === 0) {
        reply = finalMessage.content || '';
        break;
      }

      llmMessages.push({
        role: 'assistant',
        content: finalMessage.content || null,
        tool_calls: finalMessage.tool_calls,
      });

      for (const toolCall of finalMessage.tool_calls) {
        let result;
        try {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          if (toolCall.function.name === 'search_products') {
            result = await searchProductsTool(args);
            if (Array.isArray(result) && result.length > 0) {
              toolSearchResults = toolSearchResults.concat(result);
            }
          } else if (toolCall.function.name === 'check_stock') {
            result = await checkStockTool(args.productId);
          } else if (toolCall.function.name === 'add_to_cart') {
            result = await addToCartTool(args.productId, args.quantity);
          } else {
            result = { error: `Unknown tool: ${toolCall.function.name}` };
          }
        } catch (err) {
          result = { error: err.message || 'Tool execution failed' };
        }
        llmMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }

    if (!reply && finalMessage) {
      reply = finalMessage.content || '';
    }

    if (session) {
      session.messages.push({ role: 'assistant', content: reply });
      if (session.messages.length > 100) {
        session.messages.splice(0, session.messages.length - 100);
      }
      session.lastMessageAt = new Date();
      await session.save();
    }

    // Response products: retrieval results ∪ search_products results, deduped by _id
    const responseProducts = foundProducts.map(p => ({
      _id: p._id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      basePrice: p.basePrice,
      image: p.images?.[0] || null,
      tags: p.tags,
      score: p.score,
    }));

    if (toolSearchResults.length > 0) {
      const seen = new Set(responseProducts.map(p => String(p._id)));
      for (const sp of toolSearchResults) {
        if (seen.has(String(sp._id))) continue;
        seen.add(String(sp._id));
        responseProducts.push({
          _id: sp._id,
          name: sp.name,
          brand: sp.brand,
          category: sp.category,
          basePrice: sp.basePrice,
          image: sp.image || null,
          tags: sp.tags,
        });
      }
    }

    res.json({
      message: reply,
      products: responseProducts,
      sessionId: session ? session._id : null,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    // Check if it's an OpenAI API key issue
    if (error.code === 'invalid_api_key' || (error.status === 401)) {
      return res.status(503).json({ message: 'AI service not configured. Add OPENAI_API_KEY to .env.' });
    }
    res.status(500).json({ message: error.message || 'AI chat failed' });
  }
});

// POST /api/ai/embed-products — Batch-embed all products missing embeddings
router.post('/embed-products', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const products = await Product.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: { $size: 0 } },
      ],
      isActive: true,
    });

    let embedded = 0;
    for (const product of products) {
      try {
        const embedding = await generateProductEmbedding(product);
        await Product.updateOne({ _id: product._id }, { $set: { embedding } });
        embedded++;
      } catch (err) {
        console.error(`Failed to embed product ${product._id}:`, err.message);
      }
    }

    res.json({ message: `Embedded ${embedded} of ${products.length} products` });
  } catch (error) {
    console.error('Embed products error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/ai/embed-product/:id — Embed a single product (called after create/update)
router.post('/embed-product/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const embedding = await generateProductEmbedding(product);
    await Product.updateOne({ _id: product._id }, { $set: { embedding } });
    res.json({ message: 'Product embedded' });
  } catch (error) {
    console.error('Embed product error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
