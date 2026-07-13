async function generateEmbedding(text) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function generateProductEmbedding(product) {
  const text = [
    product.name,
    product.description,
    product.brand,
    product.category,
    ...(product.tags || []),
  ].filter(Boolean).join(' ');
  return generateEmbedding(text);
}

module.exports = { generateEmbedding, generateProductEmbedding };
