const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { generateEmbedding, generateProductEmbedding } = require('../utils/embeddings');
const { identifyUser, protect } = require('../middleware/auth');
const SYSTEM_PROMPT = `You are a knowledgeable fashion assistant for DRYP, a clothing store. You help users find products, answer questions about the catalog, and make personalized recommendations.

When you recommend or mention products, always include their name, brand, and price. Be concise but helpful.

If the user asks about products you don't have in your search results, honestly say you don't have that information.

Current time and date: ${new Date().toISOString()}`;

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
            source: 1, externalId: 1,
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

    if (foundProducts.length > 0) {
      productContext = 'Here are the relevant products from our catalog:\n' +
        foundProducts.map((p, i) =>
          `${i + 1}. ${p.name} — ${p.brand} — $${p.basePrice}${p.description ? `\n   ${p.description.substring(0, 150)}` : ''}`
        ).join('\n\n');
    } else {
      productContext = 'No matching products found in the catalog.';
    }

    // Generate AI response
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-6), // Last 6 messages for context
        { role: 'system', content: `Relevant catalog products:\n${productContext}` },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    res.json({
      message: reply,
      products: foundProducts.map(p => ({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        basePrice: p.basePrice,
        image: p.images?.[0] || null,
        tags: p.tags,
        score: p.score,
      })),
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
