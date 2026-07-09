require('dotenv').config();
const mongoose = require('mongoose');

const INDEX_NAME = 'product_embedding_index';
const COLLECTION_NAME = 'products';
const EMBEDDING_PATH = 'embedding';
const NUM_DIMENSIONS = 1536;
const SIMILARITY = 'cosine';

async function createVectorSearchIndex() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection(COLLECTION_NAME);

  const indexDefinition = {
    name: INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [
        {
          type: 'vector',
          path: EMBEDDING_PATH,
          numDimensions: NUM_DIMENSIONS,
          similarity: SIMILARITY,
        },
      ],
    },
  };

  let created = false;

  try {
    if (typeof collection.createSearchIndex === 'function') {
      await collection.createSearchIndex(indexDefinition);
      created = true;
    } else {
      throw new Error('createSearchIndex not available');
    }
  } catch (err) {
    const msg = String(err?.message || err);
    const isDuplicate = msg.includes('already exists') || msg.includes('duplicate') || msg.includes('IndexAlreadyExists');
    const isMethodMissing = msg.includes('createSearchIndex') && msg.includes('not a function');

    if (isDuplicate) {
      console.log(`Index "${INDEX_NAME}" already exists, skipping`);
      await mongoose.disconnect();
      process.exit(0);
    }

    if (isMethodMissing || !created) {
      try {
        await db.command({
          createSearchIndexes: COLLECTION_NAME,
          indexes: [indexDefinition],
        });
        created = true;
      } catch (cmdErr) {
        const cmdMsg = String(cmdErr?.message || cmdErr);
        if (cmdMsg.includes('already exists') || cmdMsg.includes('duplicate') || cmdMsg.includes('IndexAlreadyExists')) {
          console.log(`Index "${INDEX_NAME}" already exists, skipping`);
          await mongoose.disconnect();
          process.exit(0);
        }
        throw cmdErr;
      }
    } else {
      throw err;
    }
  }

  if (created) {
    console.log(`Created vector search index "${INDEX_NAME}"`);
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
  process.exit(0);
}

createVectorSearchIndex().catch(async (err) => {
  console.error('Failed to create vector search index:', err?.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});