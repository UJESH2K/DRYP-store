// ─── Robust cell/value extraction ────────────────────────────────────
// Handles every cell type ExcelJS can throw at us: rich text, formulas,
// merged cells, dates, numbers stored as strings, inline strings, etc.

const { Readable } = require('stream');
const ExcelJS = require('exceljs');

// ─── Header mapping (fuzzy fallback when AI is unavailable) ──────────

const HEADER_ALIASES = {
  'product name': 'productName', 'product title': 'productName', 'item name': 'productName',
  'title': 'productName', name: 'productName',
  type: 'category', category: 'category', department: 'category', collection: 'category',
  colour: 'color', color: 'color',
  size: 'size',
  price: 'price', 'price (inr)': 'price', 'price inr': 'price', 'selling price': 'price',
  'compare-at': 'compareAt', 'compare-at (inr)': 'compareAt',
  'compare at': 'compareAt', 'compare at price': 'compareAt', mrp: 'compareAt',
  sku: 'sku', 'item code': 'sku', 'product code': 'sku',
  'in stock?': 'inStock', 'in stock': 'inStock', instock: 'inStock',
  available: 'inStock',
  quantity: 'quantity', stock: 'quantity', qty: 'quantity',
  'product url': 'productUrl', url: 'productUrl', link: 'productUrl',
  description: 'description', desc: 'description', details: 'description',
  brand: 'brand', vendor: 'brand',
  tags: 'tags', image: 'image0',
};

const CONTAINS_MAP = [
  ['product name', 'productName'], ['product title', 'productName'], ['item name', 'productName'],
  ['title', 'productName'],
  ['department', 'category'], ['collection', 'category'],
  ['sku', 'sku'], ['item code', 'sku'], ['product code', 'sku'],
  ['selling price', 'price'], ['mrp', 'compareAt'],
  ['compare at', 'compareAt'],
  ['in stock', 'inStock'], ['available', 'inStock'], ['instock', 'inStock'],
  ['quantity', 'quantity'], ['stock', 'quantity'], ['qty', 'quantity'],
  ['product url', 'productUrl'], ['url', 'productUrl'], ['link', 'productUrl'],
  ['description', 'description'], ['desc', 'description'], ['details', 'description'],
  ['brand', 'brand'], ['vendor', 'brand'],
  ['tags', 'tags'],
];

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.csv']);
const MAX_CELL_VALUE_LENGTH = 1000;    // truncate blob cells before AI or grouping

// ─── Type coercion ───────────────────────────────────────────────────

const isUrl = (s) => /^https?:\/\//i.test(s);

function coerceNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = safeStr(raw);
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceBoolean(raw) {
  const v = safeStr(raw).toLowerCase();
  if (['yes', 'y', 'true', '1', 'in stock', 'available'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'out of stock', 'none', ''].includes(v)) return false;
  return null;
}

const FALSY_STOCK = new Set(['no', 'n', 'false', '0', 'none', 'out of stock', '']);
function isFalsyStock(s) { return FALSY_STOCK.has(safeStr(s).toLowerCase()); }

// Coerce ANY value to a plain string.  Handles ExcelJS rich text, numbers,
// dates, null/undefined, nested objects, arrays — never throws.
// Truncates to MAX_CELL_VALUE_LENGTH to prevent OOM on pathological cells.
function safeStr(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.length > MAX_CELL_VALUE_LENGTH
    ? value.slice(0, MAX_CELL_VALUE_LENGTH) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.length > MAX_CELL_VALUE_LENGTH
      ? value.text.slice(0, MAX_CELL_VALUE_LENGTH) + '…' : value.text;
    if (Array.isArray(value.richText)) return value.richText.map((r) => typeof r?.text === 'string' ? r.text : '').join('');
    if (typeof value.hyperlink === 'string') return value.hyperlink;
    if (typeof value.result === 'string') return value.result;
  }
  if (Array.isArray(value)) return value.map(v => safeStr(v)).join(' ');
  const str = String(value);
  return str.length > MAX_CELL_VALUE_LENGTH ? str.slice(0, MAX_CELL_VALUE_LENGTH) + '…' : str;
}

// ─── Header normalization ────────────────────────────────────────────

function normalizeHeader(raw) {
  const key = safeStr(raw).trim().toLowerCase();
  if (!key) return null;
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  for (const [substr, canonical] of CONTAINS_MAP) {
    if (key.includes(substr)) return canonical;
  }
  const imageMatch = key.match(/^image\s*(\d+)$/);
  if (imageMatch) return `image${imageMatch[1]}`;
  return null;
}

// ─── Schema discovery (AI-first) ─────────────────────────────────────

async function discoverSchema(worksheet) {
  const headerRow = worksheet.getRow(1);
  const allCols = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = safeStr(cell.value).trim();
    if (rawHeader) {
      allCols.push({ colNumber, rawHeader });
    }
  });

  // Primary: AI maps every column
  let aiMap = {};
  let aiError;
  try {
    const { aiEnhanceSchema } = require('./aiCatalogParser');
    aiMap = await aiEnhanceSchema(worksheet, allCols);
  } catch (err) {
    aiMap = {};
    aiError = `AI column mapping failed: ${err.message}`;
    console.warn(`[catalogImport] aiEnhanceSchema error: ${err.message}`);
  }

  const columns = {};
  const unknownHeaders = [];

  for (const { colNumber, rawHeader } of allCols) {
    if (aiMap[colNumber]) {
      columns[colNumber] = {
        key: aiMap[colNumber],
        rawHeader,
        type: inferType(aiMap[colNumber]),
      };
      continue;
    }

    // Fallback: fuzzy match
    const fuzzyKey = normalizeHeader(rawHeader);
    if (fuzzyKey) {
      columns[colNumber] = {
        key: fuzzyKey,
        rawHeader,
        type: inferType(fuzzyKey),
      };
    } else {
      unknownHeaders.push(rawHeader);
    }
  }

  return {
    columns,
    aiSchema: Object.keys(aiMap).length > 0 ? aiMap : undefined,
    unknownHeaders,
    aiError,
  };
}

// Type is determined by the semantic key, full stop.  No value-sampling
// heuristics — those caused the "Size typed as number" bug when early
// cells happened to be empty.

const KEY_TYPE_MAP = {
  // Numeric fields
  price:      'number',
  compareAt:  'number',
  quantity:   'number',

  // URL fields
  productUrl: 'url',
  image0: 'url', image1: 'url', image2: 'url', image3: 'url', image4: 'url',
  image5: 'url', image6: 'url', image7: 'url', image8: 'url', image9: 'url',

  // Boolean fields
  inStock: 'boolean',

  // Everything else is text
  // (productName, category, color, size, sku, description, brand, tags)
};

function inferType(key) {
  return KEY_TYPE_MAP[key] || 'text';
}

// ─── Streaming row extraction ────────────────────────────────────────

function extractRows(worksheet, columnMap) {
  const rows = [];
  const errors = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowData = {};
    const rowErrors = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const col = columnMap[colNumber];
      if (!col) return;

      const raw = safeStr(cell.value);
      const { key, type } = col;

      let validated;
      switch (type) {
        case 'number': {
          const n = coerceNumber(cell.value);
          if (n === null && raw) {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw, reason: `Expected number, got "${raw}"` });
          }
          validated = n;
          break;
        }
        case 'url':
          // Store the raw value regardless — downstream code (groupRowsIntoProducts)
          // filters with isUrl().  We only log non-URL values as parse errors.
          validated = raw || null;
          if (raw && !isUrl(raw)) {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw, reason: 'Expected URL starting with http(s)://' });
          }
          break;
        case 'boolean':
          validated = coerceBoolean(cell.value);
          break;
        default:
          validated = raw || null;
      }

      if (validated !== null && validated !== undefined && validated !== '') {
        rowData[key] = validated;
      }
    });

    if (rowErrors.length > 0) errors.push(...rowErrors);
    if (Object.keys(rowData).length > 0) {
      rowData.__row = rowNumber;
      rows.push(rowData);
    }
  });

  return { rows, errors };
}

// ─── AI-assisted row parsing (primary path) ─────────────────────────

const { aiParseRows, BATCH_SIZE: AI_BATCH_SIZE } = require('./aiCatalogRowParser');

// ─── Rule-based product grouping (fallback) ──────────────────────────

function groupRowsIntoProducts(rows, errors) {
  const products = new Map();
  const skippedRows = [];
  const allErrors = Array.isArray(errors) ? [...errors] : [];

  rows.forEach((row) => {
    const rawName = row.productName;
    if (!rawName) {
      skippedRows.push({ row: row.__row, reason: 'Missing Product Name' });
      return;
    }

    // Defensive: coerce to string — handles numbers, objects, etc.
    const name = safeStr(rawName).trim();
    if (!name) {
      skippedRows.push({ row: row.__row, reason: 'Empty Product Name' });
      return;
    }

    const price = coerceNumber(row.price);
    if (price === null || price <= 0) {
      skippedRows.push({ row: row.__row, reason: `Missing or invalid Price (got: "${safeStr(row.price)}")` });
      return;
    }

    const nameKey = name.toLowerCase();
    if (!products.has(nameKey)) {
      products.set(nameKey, {
        name,
        category: safeStr(row.category).trim() || 'Uncategorized',
        description: '',
        images: [],
        variants: [],
        tags: [],
        sourceRows: [row.__row],
      });
    } else {
      const existing = products.get(nameKey);
      if (!existing.sourceRows) existing.sourceRows = [];
      existing.sourceRows.push(row.__row);
    }
    const product = products.get(nameKey);

    const rowDesc = safeStr(row.description || '').trim();
    if (rowDesc.length > product.description.length) {
      product.description = rowDesc;
    }

    const rowImages = Object.keys(row)
      .filter((k) => /^image\d+$/.test(k))
      .sort()
      .map((k) => row[k])
      .filter((v) => isUrl(safeStr(v)));

    rowImages.forEach((img) => {
      const normalized = safeStr(img).trim();
      if (!product.images.includes(normalized)) {
        product.images.push(normalized);
      }
    });

    const qty = coerceNumber(row.quantity);
    const stock = qty !== null ? qty : (isFalsyStock(row.inStock) ? 0 : 1);

    const options = {};
    if (row.color) options.Color = safeStr(row.color).trim();
    if (row.size) options.Size = safeStr(row.size).trim();

    product.variants.push({
      options,
      sku: row.sku ? safeStr(row.sku).trim() : undefined,
      stock,
      price,
      images: rowImages.map(v => safeStr(v).trim()),
      compareAtPrice: row.compareAt ? coerceNumber(row.compareAt) || undefined : undefined,
      productUrl: row.productUrl ? safeStr(row.productUrl).trim() : undefined,
    });

    if (Array.isArray(row.tags)) {
      row.tags.forEach((t) => {
        const tag = safeStr(t).trim();
        if (tag && !product.tags.includes(tag)) product.tags.push(tag);
      });
    } else if (typeof row.tags === 'string') {
      const tag = row.tags.trim();
      if (tag && !product.tags.includes(tag)) product.tags.push(tag);
    }
  });

  const result = Array.from(products.values()).map((p) => {
    const prices = p.variants.map((v) => v.price).filter(Number.isFinite);
    if (prices.length === 0) return null;
    const minPrice = Math.min(...prices);
    if (!Number.isFinite(minPrice) || minPrice <= 0) return null;
    const maxPrice = Math.max(...prices);

    const doc = {
      name: p.name,
      category: p.category,
      basePrice: minPrice,
      images: p.images,
      sourceRows: p.sourceRows,
      description: p.description || undefined,
      tags: p.tags.length > 0 ? p.tags : undefined,
      preview: {
        variantCount: p.variants.length,
        priceRange: [minPrice, maxPrice],
        compareAtPrice: p.variants.find((v) => v.compareAtPrice)?.compareAtPrice,
        productUrl: p.variants.find((v) => v.productUrl)?.productUrl,
      },
    };

    const optionNames = new Set();
    p.variants.forEach((v) => Object.keys(v.options).forEach((k) => optionNames.add(k)));

    if (optionNames.size > 0) {
      doc.options = Array.from(optionNames).map((optName) => ({
        name: optName,
        values: Array.from(new Set(p.variants.map((v) => v.options[optName]).filter(Boolean))),
      }));
      doc.variants = p.variants.map((v) => {
        const variant = { options: v.options, stock: v.stock, price: v.price, images: v.images };
        if (v.sku) variant.sku = v.sku;
        if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice;
        if (v.productUrl) variant.productUrl = v.productUrl;
        return variant;
      });
    } else if (p.variants.length === 1) {
      const sole = p.variants[0];
      if (sole.sku) doc.sku = sole.sku;
      doc.stock = sole.stock;
    }

    return doc;
  });

  return { products: result.filter(Boolean), skippedRows, errors: allErrors };
}

// ─── Normalize AI-parsed products to match the schema above ──────────

function normalizeAiProducts(aiProducts) {
  return aiProducts
    .filter((p) => p && safeStr(p.name).trim() && Array.isArray(p.variants) && p.variants.length > 0)
    .map((p) => {
      const sourceRows = Array.isArray(p.sourceRows) ? p.sourceRows : [];
      const images = Array.from(new Set((p.images || []).map(safeStr).filter((u) => isUrl(u))));
      const variants = p.variants
        .filter((v) => Number.isFinite(v.price) && v.price > 0)
        .map((v) => ({
          options: typeof v.options === 'object' && v.options !== null ? v.options : {},
          sku: v.sku ? safeStr(v.sku).trim() : undefined,
          stock: coerceNumber(v.stock) || 0,
          price: v.price,
          images: Array.from(new Set((v.images || []).map(safeStr).filter((u) => isUrl(u)))),
          compareAtPrice: Number.isFinite(v.compareAtPrice) && v.compareAtPrice > 0 ? v.compareAtPrice : undefined,
          productUrl: v.productUrl ? safeStr(v.productUrl).trim() : undefined,
        }));

      if (variants.length === 0) return null;

      const prices = variants.map((v) => v.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      const doc = {
        name: safeStr(p.name).trim(),
        category: (safeStr(p.category).trim()) || 'Uncategorized',
        basePrice: minPrice,
        images,
        sourceRows,
        description: p.description ? safeStr(p.description).trim() : undefined,
        tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags.map(safeStr) : undefined,
        brand: p.brand ? safeStr(p.brand).trim() : undefined,
      };

      const optionNames = new Set();
      variants.forEach((v) => Object.keys(v.options).forEach((k) => optionNames.add(k)));

      if (optionNames.size > 0) {
        doc.options = Array.from(optionNames).map((optName) => ({
          name: optName,
          values: Array.from(new Set(variants.map((v) => safeStr(v.options[optName])).filter(Boolean))),
        }));
        doc.variants = variants.map((v) => {
          const out = { options: v.options, stock: v.stock, price: v.price, images: v.images };
          if (v.sku) out.sku = v.sku;
          if (v.compareAtPrice) out.compareAtPrice = v.compareAtPrice;
          if (v.productUrl) out.productUrl = v.productUrl;
          return out;
        });
      } else if (variants.length === 1) {
        const sole = variants[0];
        if (sole.sku) doc.sku = sole.sku;
        doc.stock = sole.stock;
      }

      doc.preview = {
        variantCount: variants.length,
        priceRange: [minPrice, maxPrice],
        compareAtPrice: variants.find((v) => v.compareAtPrice)?.compareAtPrice,
        productUrl: variants.find((v) => v.productUrl)?.productUrl,
      };

      return doc;
    })
    .filter(Boolean);
}

// ─── Bulk DB ops ─────────────────────────────────────────────────────

function buildProductBulkOps(vendor, products, source = 'manual_import') {
  const { normalizeImageKeys } = require('./imageUrls');
  return products.map((p) => {
    const doc = {
      name: safeStr(p.name).trim(),
      category: safeStr(p.category).trim() || 'Uncategorized',
      basePrice: p.basePrice,
      images: normalizeImageKeys((p.images || []).map(safeStr)),
      brand: safeStr(vendor.name),
      vendor: vendor.owner,
      source,
    };
    if (p.description) doc.description = safeStr(p.description).trim();
    if (Array.isArray(p.tags) && p.tags.length > 0) doc.tags = p.tags.map(safeStr);
    if (Array.isArray(p.options)) doc.options = p.options;
    if (Array.isArray(p.variants)) {
      doc.variants = p.variants.map((variant) => ({
        ...variant,
        images: normalizeImageKeys((variant.images || []).map(safeStr)),
      }));
    }
    if (p.sku) doc.sku = safeStr(p.sku).trim();
    if (p.stock !== undefined) doc.stock = p.stock;

    return {
      updateOne: {
        filter: { vendor: vendor.owner, name: doc.name },
        update: { $set: doc },
        upsert: true,
      },
    };
  });
}

// ─── Public API ──────────────────────────────────────────────────────

// parseCatalogFile is AI-first:
//   1. AI maps every column header
//   2. AI parses rows into structured products (batched, resilient)
//   3. On any AI failure → falls back to rule-based extraction + grouping
//
// Returns { rows, errors, unknownHeaders, aiSchema, aiParsed, usedAI }
async function parseCatalogFile(buffer, filename) {
  const ext = (String(filename || '').match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const error = new Error(
      'Unsupported file type. Please upload a .xlsx or .csv file (legacy .xls is not supported — re-save as .xlsx).',
    );
    error.status = 400;
    throw error;
  }

  const workbook = new ExcelJS.Workbook();
  if (ext === '.csv') {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const error = new Error('The uploaded file has no worksheets.');
    error.status = 400;
    throw error;
  }

  // Phase 1: Schema discovery (AI-first)
  const { columns: columnMap, aiSchema, unknownHeaders, aiError } = await discoverSchema(worksheet);

  // Phase 2: Extract raw row data
  const { rows, errors } = extractRows(worksheet, columnMap);

  if (rows.length === 0) {
    return { rows: [], errors, unknownHeaders, aiSchema, aiParsed: null, usedAI: false, aiError };
  }

  // Phase 2.5: AI parses rows into products (primary).
  // For very large files, skip AI and use rule-based parser — much faster.
  // Threshold: 5000 rows or ~100k cells of payload.
  const AI_ROW_THRESHOLD = 5000;
  let aiParsed = null;
  let usedAI = false;
  if (rows.length <= AI_ROW_THRESHOLD) {
    try {
      aiParsed = await aiParseRows(columnMap, rows);
      if (aiParsed && aiParsed.products && aiParsed.products.length > 0) {
        usedAI = true;
      } else {
        aiParsed = null;
      }
    } catch {
      aiParsed = null;
    }
  } else {
    console.log(`[catalogImport] ${rows.length} rows exceeds AI threshold (${AI_ROW_THRESHOLD}); using rule-based parser`);
  }

  return { rows, errors, unknownHeaders, aiSchema, aiParsed, usedAI, aiError };
}

// ─── Exports ─────────────────────────────────────────────────────────

module.exports = {
  parseCatalogFile,
  groupRowsIntoProducts,
  buildProductBulkOps,
  normalizeAiProducts,
  safeStr,
  coerceNumber,
  coerceBoolean,
  isUrl,
  MAX_CELL_VALUE_LENGTH,
};
