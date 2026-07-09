require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const { embedBatch } = require('./src/utils/embedding');

async function generateEmbeddings() {
  const products = await Product.find({ isActive: true });
  if (products.length === 0) { console.log('No products to embed'); return; }
  const texts = products.map(p => `${p.name} ${p.brand} ${p.category} ${(p.tags||[]).join(' ')} ${p.description||''}`);
  let embeddings;
  try {
    embeddings = await embedBatch(texts);
  } catch (e) {
    console.log('OPENAI_API_KEY is missing or invalid. Add a real key to backend/.env, then run npm run embed.');
    return;
  }
  for (let i = 0; i < products.length; i++) {
    await Product.updateOne({ _id: products[i]._id }, { embedding: embeddings[i] });
  }
  console.log(`Embedded ${products.length}/${products.length} products`);
}

async function main() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  await generateEmbeddings();
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { generateEmbeddings };