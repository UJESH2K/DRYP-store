const express = require('express');
const { identifyUser } = require('../middleware/auth');
const StylistConversation = require('../models/StylistConversation');
const Product = require('../models/Product');
const { buildStyleProfile } = require('../utils/styleProfile');
const { embed } = require('../utils/embedding');

const router = express.Router();
let _openai;
function getOpenAI() { if (!_openai) { const OpenAI = require('openai'); _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); } return _openai; }

const SYSTEM_PROMPT = `You are Zaloga, an AI fashion stylist for DRYP — a mobile fashion discovery app.
You help users build outfits, find complementary pieces, and discover new styles from the DRYP catalog.
Be concise, warm, and fashion-forward. Suggest specific products when possible.
When the user shares an image, analyze the clothing and suggest matching items.
Always respond in 2-4 short paragraphs max. Use bullet points for product suggestions.`;

const CHAT_MODEL = 'gpt-4o-mini';
const INPUT_TOKEN_COST = 0.15 / 1_000_000;
const OUTPUT_TOKEN_COST = 0.60 / 1_000_000;

const SEARCH_STOP_WORDS = new Set([
  'about', 'after', 'based', 'build', 'cart', 'could', 'find', 'from',
  'ideas', 'items', 'like', 'likes', 'look', 'looking', 'make', 'need',
  'outfit', 'please', 'prefs', 'recommend', 'show', 'style', 'suggest',
  'that', 'this', 'wear', 'what', 'with', 'would', 'your',
]);

function hasValidOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-your-'));
}

function estimateAndLogTokenCost(usage) {
  if (!usage) {
    console.warn('[Zaloga] Token usage unavailable for this LLM call.');
    return;
  }

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = (promptTokens * INPUT_TOKEN_COST) + (completionTokens * OUTPUT_TOKEN_COST);
  const message = `[Zaloga] Tokens: ${promptTokens} prompt, ${completionTokens} completion, $${estimatedCost.toFixed(6)} estimated cost`;

  if (totalTokens > 5000) {
    console.warn(`${message} (exceeds 5000 total tokens)`);
  } else {
    console.log(message);
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function singularize(word) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

function extractSearchTerms(queryText) {
  return String(queryText || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word))
    .map(singularize)
    .slice(0, 6);
}

function categoryMatchesQuery(category, queryTerms, queryText) {
  const categoryTerms = extractSearchTerms(category);
  const termSet = new Set(queryTerms);
  const normalizedQuery = String(queryText || '').toLowerCase();
  const normalizedCategory = String(category || '').toLowerCase();

  return categoryTerms.some((term) => termSet.has(term)) ||
    (normalizedCategory.length > 2 && normalizedQuery.includes(normalizedCategory));
}

async function textSearchCatalog(queryText, limit) {
  const searchTerms = extractSearchTerms(queryText);
  if (searchTerms.length === 0) return [];

  const categories = await Product.distinct('category', { isActive: true });
  const matchingCategories = categories.filter((category) =>
    categoryMatchesQuery(category, searchTerms, queryText)
  );

  if (matchingCategories.length > 0) {
    return Product.find({ isActive: true, category: { $in: matchingCategories } })
      .select('name brand category tags basePrice images')
      .limit(limit)
      .lean();
  }

  const phrase = String(queryText || '').trim().replace(/\s+/g, ' ');
  if (phrase.length > 2) {
    const phraseRegex = new RegExp(escapeRegex(phrase), 'i');
    const phraseResults = await Product.find({
      isActive: true,
      $or: [{ name: phraseRegex }, { category: phraseRegex }],
    })
      .select('name brand category tags basePrice images')
      .limit(limit)
      .lean();

    if (phraseResults.length > 0) return phraseResults;
  }

  const categoryRegex = new RegExp(`\\b(${searchTerms.map(escapeRegex).join('|')})s?\\b`, 'i');
  return Product.find({ isActive: true, category: categoryRegex })
    .select('name brand category tags basePrice images')
    .limit(limit)
    .lean();
}

/**
 * Vector search the product catalog using MongoDB Atlas vector search.
 * Falls back to text search if vector search is unavailable.
 */
async function searchCatalog(queryEmbedding, queryText, limit = 10) {
  if (queryEmbedding) {
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'product_embedding_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: limit * 5,
            limit: limit,
          },
        },
        { $match: { isActive: true } },
        {
          $project: {
            name: 1, brand: 1, category: 1, tags: 1, basePrice: 1, images: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];
      const results = await Product.aggregate(pipeline);
      if (results.length > 0) return results;
    } catch (e) {
      // Atlas Vector Search index may not exist yet — fall through to text search
      console.warn('Vector search unavailable, falling back to text search:', e.message);
    }
  }

  return textSearchCatalog(queryText, limit);
}

function ownsConversation(convo, userId, guestId) {
  return (userId && convo.user?.toString() === userId.toString()) ||
    (guestId && convo.guestId === guestId);
}

function buildDevReply(matchedProducts, imageUrl) {
  const imageNote = imageUrl ? 'I can see the image you shared. ' : '';
  const greeting = matchedProducts.length > 0
    ? imageNote + 'I\'ve picked out a few pieces I think you\'ll love!'
    : imageNote + 'Thanks for reaching out! Let me think about what would suit you best.';
  const parts = [greeting, ''];

  matchedProducts.forEach((p) => {
    const priceStr = p.basePrice ? `$${Number(p.basePrice).toFixed(2)}` : '';
    parts.push(`* **${p.name}**${priceStr ? ` (${priceStr})` : ''}${p.brand ? ` by ${p.brand}` : ''}`);
    parts.push('');
  });

  if (matchedProducts.length > 0) {
    parts.push('Each of these would blend seamlessly into your wardrobe.');
    parts.push('');
  }

  parts.push('Want me to suggest how to style any of these, or describe the fit in more detail?');
  return parts.join('\n');
}

async function prepareStylistRequest(req) {
  const { message, conversationId, imageUrl, userContext } = req.body;
  if (!message && !imageUrl) {
    const error = new Error('Message or imageUrl required');
    error.status = 400;
    throw error;
  }

  const userId = req.user?._id;
  const guestId = req.guestId;
  const userMessage = message || 'What should I wear with this?';

  let convo;
  if (conversationId) {
    convo = await StylistConversation.findById(conversationId);
    if (!convo) {
      const error = new Error('Conversation not found');
      error.status = 404;
      throw error;
    }
    if (!ownsConversation(convo, userId, guestId)) {
      const error = new Error('Not authorized');
      error.status = 403;
      throw error;
    }
  } else {
    convo = await StylistConversation.create({
      user: userId || undefined,
      guestId: guestId || undefined,
      title: userMessage.slice(0, 60),
    });
  }

  convo.messages.push({
    role: 'user',
    content: userMessage,
    imageUrl: imageUrl || undefined,
  });

  let styleProfile = await buildStyleProfile(userId, guestId);
  const recentSignals = userContext?.recentSignals;
  if (recentSignals?.disliked?.length > 0) {
    styleProfile += '\n\nItems user recently disliked (avoid recommending similar):\n' +
      recentSignals.disliked.map((id) => `- ${id}`).join('\n');
  }

  let catalogContext = '';
  let matchedProducts = [];
  const validKey = hasValidOpenAIKey();

  try {
    const queryText = message || 'style recommendation';
    const queryEmbedding = validKey ? await embed(queryText) : null;
    matchedProducts = await searchCatalog(queryEmbedding, queryText, 10);

    if (matchedProducts.length > 0) {
      catalogContext = 'Matching products from DRYP catalog:\n' +
        matchedProducts.map((p, i) =>
          `${i + 1}. ${p.name} by ${p.brand} — ${p.category}, $${p.basePrice}${p.tags?.length ? ` [${p.tags.join(', ')}]` : ''}`
        ).join('\n');
    }
  } catch (e) {
    console.warn('Embedding/search failed, continuing without catalog context:', e.message);
  }

  const recentMessages = convo.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.role === 'user' && m.imageUrl
      ? [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: m.imageUrl } }]
      : m.content,
  }));

  const llmMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${styleProfile}\n\n${catalogContext}` },
    ...recentMessages,
  ];

  return {
    convo,
    hasValidKey: validKey,
    imageUrl,
    llmMessages,
    matchedProducts,
    productIds: matchedProducts.map(p => p._id),
    userMessage,
  };
}

async function generateBlockingReply({ hasValidKey, llmMessages, matchedProducts, imageUrl }) {
  if (!hasValidKey) return buildDevReply(matchedProducts, imageUrl);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: llmMessages,
      max_tokens: 800,
      temperature: 0.7,
    });
    estimateAndLogTokenCost(completion.usage);
    return completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (llmError) {
    console.warn('LLM call failed:', llmError.message);
    return 'Sorry, I encountered an issue generating suggestions. Please try again.';
  }
}

function writeSse(res, event, payload) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function streamDevReply(reply, res) {
  const chunks = reply.match(/\S+\s*/g) || [reply];
  chunks.forEach((chunk) => writeSse(res, 'token', { text: chunk }));
}

async function generateStreamingReply({ hasValidKey, llmMessages, matchedProducts, imageUrl }, res) {
  if (!hasValidKey) {
    const reply = buildDevReply(matchedProducts, imageUrl);
    streamDevReply(reply, res);
    return reply;
  }

  let reply = '';
  let usage;

  try {
    const stream = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: llmMessages,
      max_tokens: 800,
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        reply += delta;
        writeSse(res, 'token', { text: delta });
      }
      if (chunk.usage) usage = chunk.usage;
    }

    estimateAndLogTokenCost(usage);
    return reply || 'Sorry, I could not generate a response.';
  } catch (llmError) {
    console.warn('LLM stream failed:', llmError.message);
    if (reply) return reply;

    const fallback = 'Sorry, I encountered an issue generating suggestions. Please try again.';
    writeSse(res, 'token', { text: fallback });
    return fallback;
  }
}

async function saveAndBuildResponse({ convo, reply, productIds, userMessage }) {
  convo.messages.push({
    role: 'assistant',
    content: reply,
    productIds,
  });

  if (convo.messages.length === 2 && convo.title === 'New styling session') {
    convo.title = userMessage.slice(0, 60);
  }

  await convo.save();

  const suggestions = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } })
        .select('name brand category basePrice images tags')
        .lean()
    : [];

  return {
    reply,
    productIds,
    suggestions,
    conversationId: convo._id,
  };
}

/**
 * POST /api/stylist/chat
 * Body: { message, conversationId?, imageUrl? }
 * Returns JSON by default, or SSE when Accept includes text/event-stream.
 */
router.post('/', identifyUser, async (req, res, next) => {
  const wantsStream = req.headers.accept?.includes('text/event-stream');

  try {
    const prepared = await prepareStylistRequest(req);

    if (!wantsStream) {
      const reply = await generateBlockingReply(prepared);
      const payload = await saveAndBuildResponse({ ...prepared, reply });
      return res.json(payload);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    writeSse(res, 'meta', { conversationId: prepared.convo._id });
    const reply = await generateStreamingReply(prepared, res);
    const payload = await saveAndBuildResponse({ ...prepared, reply });
    writeSse(res, 'done', payload);
    return res.end();
  } catch (error) {
    if (wantsStream && res.headersSent) {
      writeSse(res, 'error', { message: error.message || 'Stylist request failed' });
      return res.end();
    }

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    next(error);
  }
});

/**
 * GET /api/stylist/conversations
 * List user's conversations (most recent first).
 */
router.get('/conversations', identifyUser, async (req, res, next) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId };
    if (!req.user && !req.guestId) return res.json([]);

    const convos = await StylistConversation.find(query)
      .select('title createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    // Return summary (last message preview, not full history)
    const summaries = convos.map(c => ({
      _id: c._id,
      title: c.title,
      lastMessage: c.messages[c.messages.length - 1]?.content || '',
      messageCount: c.messages.length,
      updatedAt: c.updatedAt,
    }));

    return res.json(summaries);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stylist/conversations/:id
 * Get a single conversation with full messages.
 */
router.get('/conversations/:id', identifyUser, async (req, res, next) => {
  try {
    const convo = await StylistConversation.findById(req.params.id).lean();
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });

    // Ensure user owns this conversation
    const userId = req.user?._id?.toString();
    const guestId = req.guestId;
    if (convo.user?.toString() !== userId && convo.guestId !== guestId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    return res.json(convo);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
