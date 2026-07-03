const { Readable } = require('stream');
const readline = require('readline');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const ShopifyImport = require('../models/ShopifyImport');
const sendEmail = require('../utils/sendEmail');
const { decrypt } = require('../utils/crypto');
const { shopifyGraphQL } = require('../utils/shopifyClient');

// Single root field (`products`), as required by Shopify's Bulk Operations API.
// Collections are nested under each product rather than queried separately, since
// DRYP has no Collection model yet (v1 folds them into Product.tags).
const PRODUCTS_BULK_QUERY = `
  {
    products {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          productType
          tags
          collections(first: 10) { edges { node { title } } }
          images(first: 50) { edges { node { url } } }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                price
                inventoryQuantity
                selectedOptions { name value }
              }
            }
          }
        }
      }
    }
  }
`;

const BULK_OPERATION_RUN_QUERY_MUTATION = `
  mutation bulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation { id status }
      userErrors { field message }
    }
  }
`;

const CURRENT_BULK_OPERATION_QUERY = `
  {
    currentBulkOperation {
      id
      status
      errorCode
      objectCount
      url
    }
  }
`;

const markImportFailed = async (vendor, importDoc, message) => {
  console.error('Shopify import failed:', message);
  if (importDoc) {
    importDoc.status = 'failed';
    importDoc.error = message;
    importDoc.completedAt = new Date();
    await importDoc.save();
  }
  if (vendor?.shopify) {
    vendor.shopify.importStatus = 'failed';
    vendor.shopify.importError = message;
    await vendor.save();
  }
  if (vendor?.email) {
    await sendEmail({
      email: vendor.email,
      subject: 'DRYP: Shopify import failed',
      message: `We couldn't finish importing your Shopify store: ${message}`,
    }).catch((err) => console.error('Failed to send import-failure email:', err.message));
  }
};

// Streams a Shopify bulk-operation JSONL result line-by-line, so large catalogs
// don't have to be buffered into memory all at once.
const streamBulkResult = async (url, onLine) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download bulk result: ${res.status}`);
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) onLine(JSON.parse(line));
  }
};

module.exports = (agenda) => {
  agenda.define('shopify:start-bulk-import', async (job) => {
    const { vendorId } = job.attrs.data;
    const vendor = await Vendor.findById(vendorId).select('+shopify.accessTokenEnc');
    if (!vendor || !vendor.shopify?.accessTokenEnc) {
      console.error(`shopify:start-bulk-import: vendor ${vendorId} has no connected Shopify store`);
      return;
    }

    let importDoc;
    try {
      importDoc = await ShopifyImport.create({
        vendor: vendor._id,
        shopDomain: vendor.shopify.shopDomain,
        status: 'running',
        startedAt: new Date(),
      });

      vendor.shopify.importStatus = 'importing';
      vendor.shopify.importError = undefined;
      await vendor.save();

      const accessToken = decrypt(vendor.shopify.accessTokenEnc);
      const data = await shopifyGraphQL(
        vendor.shopify.shopDomain,
        accessToken,
        BULK_OPERATION_RUN_QUERY_MUTATION,
        { query: PRODUCTS_BULK_QUERY },
      );

      const { bulkOperation, userErrors } = data.bulkOperationRunQuery;
      if (userErrors?.length) {
        throw new Error(`bulkOperationRunQuery userErrors: ${JSON.stringify(userErrors)}`);
      }

      importDoc.bulkOperationId = bulkOperation.id;
      await importDoc.save();

      await agenda.schedule('in 15 seconds', 'shopify:poll-bulk-operation', {
        vendorId: vendor._id.toString(),
        importId: importDoc._id.toString(),
      });
    } catch (err) {
      await markImportFailed(vendor, importDoc, err.message);
    }
  });

  agenda.define('shopify:poll-bulk-operation', async (job) => {
    const { vendorId, importId } = job.attrs.data;
    const vendor = await Vendor.findById(vendorId).select('+shopify.accessTokenEnc');
    const importDoc = await ShopifyImport.findById(importId);
    if (!vendor || !importDoc) return;

    try {
      const accessToken = decrypt(vendor.shopify.accessTokenEnc);
      const data = await shopifyGraphQL(vendor.shopify.shopDomain, accessToken, CURRENT_BULK_OPERATION_QUERY);
      const op = data.currentBulkOperation;

      if (!op) throw new Error('No current bulk operation found on the shop');

      if (op.status === 'RUNNING' || op.status === 'CREATED') {
        await agenda.schedule('in 15 seconds', 'shopify:poll-bulk-operation', { vendorId, importId });
        return;
      }

      if (op.status === 'COMPLETED') {
        importDoc.status = 'downloading';
        importDoc.objectCount = Number(op.objectCount || 0);
        await importDoc.save();
        await agenda.now('shopify:process-bulk-result', { vendorId, importId, url: op.url });
        return;
      }

      throw new Error(`Bulk operation ended with status ${op.status}${op.errorCode ? ` (${op.errorCode})` : ''}`);
    } catch (err) {
      await markImportFailed(vendor, importDoc, err.message);
    }
  });

  agenda.define('shopify:process-bulk-result', async (job) => {
    const { vendorId, importId, url } = job.attrs.data;
    const vendor = await Vendor.findById(vendorId);
    const importDoc = await ShopifyImport.findById(importId);
    if (!vendor || !importDoc) return;

    try {
      importDoc.status = 'processing';
      await importDoc.save();

      // Assemble each product from its root line plus its child lines (images,
      // variants, collections), matched via Shopify's `__parentId` linkage.
      const products = new Map();

      await streamBulkResult(url, (obj) => {
        if (!obj.__parentId) {
          products.set(obj.id, {
            externalId: obj.id,
            name: obj.title,
            description: obj.descriptionHtml || '',
            brand: obj.vendor || vendor.name,
            category: obj.productType || 'Uncategorized',
            tags: new Set(obj.tags || []),
            images: [],
            variants: [],
          });
          return;
        }

        const parent = products.get(obj.__parentId);
        if (!parent) return;

        if (typeof obj.url === 'string') {
          parent.images.push(obj.url); // Image line
        } else if (obj.price !== undefined) {
          // Variant line
          const options = {};
          for (const opt of obj.selectedOptions || []) {
            options[opt.name] = opt.value;
          }
          parent.variants.push({
            options,
            sku: obj.sku || null,
            stock: Math.max(0, obj.inventoryQuantity || 0),
            price: Number(obj.price),
          });
        } else if (typeof obj.title === 'string') {
          parent.tags.add(obj.title); // Collection line
        }
      });

      const bulkOps = [];

      for (const p of products.values()) {
        const optionNames = new Set();
        for (const v of p.variants) {
          Object.keys(v.options).forEach((k) => optionNames.add(k));
        }

        const doc = {
          name: p.name,
          description: p.description,
          brand: p.brand,
          category: p.category,
          tags: Array.from(p.tags),
          basePrice: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0,
          images: p.images,
          vendor: vendor.owner,
          externalId: p.externalId,
          source: 'shopify',
        };

        if (optionNames.size > 0) {
          doc.options = Array.from(optionNames).map((name) => ({
            name,
            values: Array.from(new Set(p.variants.map((v) => v.options[name]).filter(Boolean))),
          }));
          doc.variants = p.variants.map((v) => {
            const variant = { options: v.options, stock: v.stock, price: v.price };
            if (v.sku) variant.sku = v.sku;
            return variant;
          });
        } else if (p.variants.length === 1) {
          if (p.variants[0].sku) doc.sku = p.variants[0].sku;
          doc.stock = p.variants[0].stock;
        }

        bulkOps.push({
          updateOne: {
            filter: { vendor: vendor.owner, externalId: p.externalId },
            update: { $set: doc },
            upsert: true,
          },
        });
      }

      if (bulkOps.length) {
        await Product.bulkWrite(bulkOps);
      }

      importDoc.status = 'completed';
      importDoc.productsImported = bulkOps.length;
      importDoc.completedAt = new Date();
      await importDoc.save();

      vendor.shopify.importStatus = 'completed';
      vendor.shopify.lastImportedAt = new Date();
      await vendor.save();

      await sendEmail({
        email: vendor.email,
        subject: 'DRYP: Shopify import complete',
        message: `Your Shopify store import finished. ${bulkOps.length} products were imported.`,
      }).catch((err) => console.error('Failed to send import-complete email:', err.message));
    } catch (err) {
      await markImportFailed(vendor, importDoc, err.message);
    }
  });
};
