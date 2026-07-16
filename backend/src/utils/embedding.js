let _openai;

function getClient() {
  if (!_openai) {
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions

function assertValidKey() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your-')) {
    throw new Error('Valid OPENAI_API_KEY required for embeddings');
  }
}

async function embed(text) {
  assertValidKey();
  const openai = getClient();
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

async function embedBatch(texts) {
  assertValidKey();
  const openai = getClient();
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data.map(d => d.embedding);
}

module.exports = { embed, embedBatch, EMBEDDING_MODEL, ensureVectorIndex };
