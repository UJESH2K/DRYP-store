const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { normalizeImageKeys } = require('./imageUrls');
const { aiEnhanceSchema } = require('./aiCatalogParser');
const { aiParseRows } = require('./aiCatalogRowParser');

// ─── Header mapping ────────────────────────────────────────────────

const HEADER_ALIASES = {
  'product name': 'productName',
  'product title': 'productName',
  'item name': 'productName',
  'title': 'productName',
  name: 'productName',
  type: 'category',
  category: 'category',
  department: 'category',
  collection: 'category',
  colour: 'color',
  color: 'color',
  size: 'size',
  price: 'price',
  'price (inr)': 'price',
  'price inr': 'price',
  'selling price': 'price',
  'compare-at': 'compareAt',
  'compare-at (inr)': 'compareAt',
  'compare at': 'compareAt',
  'compare at price': 'compareAt',
  mrp: 'compareAt',
  sku: 'sku',
  'item code': 'sku',
  'product code': 'sku',
  'in stock?': 'inStock',
  'in stock': 'inStock',
  instock: 'inStock',
  available: 'inStock',
  quantity: 'quantity',
  stock: 'quantity',
  qty: 'quantity',
  'product url': 'productUrl',
  url: 'productUrl',
  link: 'productUrl',
  description: 'description',
  desc: 'description',
  details: 'description',
  brand: 'brand',
  vendor: 'brand',
  tags: 'tags',
  image: 'image0',
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

// ─── Type validation ───────────────────────────────────────────────

const isUrl = (s) => /^https?:\/\//i.test(s);

const coerceNumber = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw || '').trim();
  if (!s) return null; // ponytail: null = "absent", not "zero"
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const coerceBoolean = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'in stock', 'available'].includes(v)) return true;
  if (['no', 'n', 'false', '0', 'out of stock', 'none', ''].includes(v)) return false;
  return null; // ambiguous
};

const FALSY_STOCK = new Set(['no', 'n', 'false', '0', 'none', 'out of stock', '']);

const isFalsyStock = (s) => FALSY_STOCK.has(String(s || '').trim().toLowerCase());

// ─── Cell extraction ───────────────────────────────────────────────

const cellText = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0]; // date → YYYY-MM-DD
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('').trim();
    if (value.hyperlink) return String(value.hyperlink).trim();
  }
  return String(value).trim();
};

// ─── Header normalization ──────────────────────────────────────────

const normalizeHeader = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];

  for (const [substr, canonical] of CONTAINS_MAP) {
    if (key.includes(substr)) return canonical;
  }

  const imageMatch = key.match(/^image\s*(\d+)$/);
  if (imageMatch) return `image${imageMatch[1]}`;
  return null;
};

// ─── Phase 1: Schema discovery (AI-first, fuzzy fallback) ─────────

async function discoverSchema(worksheet) {
  const headerRow = worksheet.getRow(1);
  const allCols = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = String(cell.value).trim();
    if (rawHeader) {
      allCols.push({ colNumber, rawHeader });
    }
  });

  let aiMap = {};
  try {
    aiMap = await aiEnhanceSchema(worksheet, allCols);
  } catch {
    aiMap = {};
  }

  const columns = {};
  const unknownHeaders = [];

  for (const { colNumber, rawHeader } of allCols) {
    if (aiMap[colNumber]) {
      columns[colNumber] = {
        key: aiMap[colNumber],
        rawHeader,
        type: inferType(worksheet, colNumber),
      };
      continue;
    }

    const fuzzyKey = normalizeHeader(rawHeader);
    if (fuzzyKey) {
      columns[colNumber] = {
        key: fuzzyKey,
        rawHeader,
        type: inferType(worksheet, colNumber),
      };
    } else {
      unknownHeaders.push(rawHeader);
    }
  }

  return {
    columns,
    aiSchema: Object.keys(aiMap).length > 0 ? aiMap : undefined,
    unknownHeaders,
  };
}

function inferType(worksheet, colNumber) {
  const samples = [];
  for (let rowNum = 2; rowNum <= Math.min(5, worksheet.rowCount); rowNum++) {
    const cell = worksheet.getRow(rowNum).getCell(colNumber);
    if (cell.value !== null && cell.value !== undefined) {
      samples.push(cell.value);
    }
    if (samples.length >= 3) break;
  }

  if (samples.length === 0) return 'text';

  // Check if all numeric samples
  const numericCount = samples.filter(v => {
    const n = coerceNumber(v);
    return n !== null && Number.isFinite(n);
  }).length;

  if (numericCount === samples.length) return 'number';

  // Check if all URL-like
  const urlCount = samples.filter(v => isUrl(cellText(v))).length;
  if (urlCount === samples.length) return 'url';

  // Check if all boolean-like
  const boolCount = samples.filter(v => coerceBoolean(v) !== null).length;
  if (boolCount === samples.length) return 'boolean';

  return 'text';
}

// ─── Phase 2: Streaming parse ──────────────────────────────────────

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

  const { columns: columnMap, aiSchema, unknownHeaders } = await discoverSchema(worksheet);

  // Phase 2: Streaming parse with per-cell validation
  const rows = [];
  const errors = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowData = {};
    const rowErrors = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const col = columnMap[colNumber];
      if (!col) return;

      const raw = cellText(cell.value);
      const { key, type } = col;

      // Validate by inferred type
      let validated;
      switch (type) {
        case 'number': {
          const n = coerceNumber(cell.value);
          if (n === null && cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw: cellText(cell.value), reason: `Expected number, got "${cellText(cell.value)}"` });
          }
          validated = n;
          break;
        }
        case 'url':
          if (raw && !isUrl(raw)) {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw, reason: 'Expected URL starting with http(s)://' });
          }
          validated = isUrl(raw) ? raw : null;
          break;
        case 'boolean':
          validated = coerceBoolean(cell.value);
          break;
        default:
          validated = raw;
      }

      if (validated !== null && validated !== undefined && validated !== '') {
        rowData[key] = validated;
      }
    });

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    }

    if (Object.keys(rowData).length > 0) {
      rowData.__row = rowNumber;
      rows.push(rowData);
    }
  });

  const unknownHeaders = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const key = normalizeHeader(cell.value);
    if (!key && cell.value) {
      unknownHeaders.push(String(cell.value).trim());
    }
  });

  // Phase 2.5: AI-powered row parsing (optional, with graceful fallback)
  // Sends the already-validated row data to OpenAI for intelligent grouping,
  // normalization, and structuring.  If the API key is missing or the call
  // fails for any reason, fall back to the local rule-based row stream.
  let aiParsed = null;
  try {
    aiParsed = await aiParseRows(columnMap, rows);
  } catch {
    aiParsed = null;
  }

  if (aiSchema) {
    const mappedColNumbers = new Set(
      Object.keys(aiSchema).map(Number),
    );
    const mappedHeaders = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (mappedColNumbers.has(colNumber)) {
        mappedHeaders.push(String(cell.value).trim());
      }
    });
    return {
      rows,
      errors,
      unknownHeaders: unknownHeaders.filter((h) => !mappedHeaders.includes(h)),
      aiSchema,
      aiParsed,
    };
  }

  return { rows, errors, unknownHeaders, aiSchema, aiParsed };
}

// ─── Phase 3: Product grouping ─────────────────────────────────────

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
    const name = rawName.trim();
    const price = coerceNumber(row.price);

    if (price === null || price <= 0) {
      skippedRows.push({ row: row.__row, reason: `Missing or invalid Price (got: "${row.price}")` });
      return;
    }

    // Case-insensitive dedup, preserve first-seen casing
    const nameKey = name.toLowerCase();
    if (!products.has(nameKey)) {
      products.set(nameKey, {
        name,
        category: row.category || 'Uncategorized',
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

    // Description: longest wins (most detail)
    const rowDesc = row.description || '';
    if (rowDesc.length > product.description.length) {
      product.description = rowDesc;
    }

    // Images: union, deduplicated
    const rowImages = Object.keys(row)
      .filter((k) => /^image\d+$/.test(k))
      .sort()
      .map((k) => row[k])
      .filter((v) => isUrl(v));
    rowImages.forEach((img) => {
      const normalized = img.trim();
      if (!product.images.includes(normalized)) {
        product.images.push(normalized);
      }
    });

    // Stock logic: quantity overrides inStock
    const qty = coerceNumber(row.quantity);
    const stock = qty !== null ? qty : (isFalsyStock(row.inStock) ? 0 : 1);

    // Variant options
    const options = {};
    if (row.color) options.Color = row.color;
    if (row.size) options.Size = row.size;

    product.variants.push({
      options,
      sku: row.sku || undefined,
      stock,
      price,
      images: rowImages,
      compareAtPrice: row.compareAt ? coerceNumber(row.compareAt) || undefined : undefined,
      productUrl: row.productUrl || undefined,
    });

    // Tags: collect unique
    if (Array.isArray(row.tags)) {
      row.tags.forEach((t) => {
        const tag = String(t).trim();
        if (tag && !product.tags.includes(tag)) {
          product.tags.push(tag);
        }
      });
    } else if (typeof row.tags === 'string' && row.tags.trim()) {
      const tag = row.tags.trim();
      if (!product.tags.includes(tag)) product.tags.push(tag);
    }
  });

  // Phase 4: Validation
  const result = Array.from(products.values()).map((p) => {
    const prices = p.variants.map((v) => v.price).filter((v) => Number.isFinite(v));

    if (prices.length === 0) {
      return null;
    }

    const validPrices = prices.filter(Number.isFinite);
    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);

    if (!Number.isFinite(minPrice) || minPrice <= 0) {
      return null;
    }

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

    // Build option definitions
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

  return { products: result.filter(Boolean), skippedRows, errors: errors || [] };
}

// ─── Phase 5: Bulk ops for DB ──────────────────────────────────────

const buildProductBulkOps = (vendor, products, source = 'manual_import') => {
  return products.map((p) => {
    const doc = {
      name: p.name,
      category: p.category || 'Uncategorized',
      basePrice: p.basePrice,
      images: normalizeImageKeys(p.images || []),
      brand: vendor.name,
      vendor: vendor.owner,
      source,
    };
    if (p.description) doc.description = p.description;
    if (Array.isArray(p.tags) && p.tags.length > 0) doc.tags = p.tags;
    if (Array.isArray(p.options)) doc.options = p.options;
    if (Array.isArray(p.variants)) {
      doc.variants = p.variants.map((variant) => ({
        ...variant,
        images: normalizeImageKeys(variant.images || []),
      }));
    }
    if (p.sku) doc.sku = p.sku;
    if (p.stock !== undefined) doc.stock = p.stock;

    return {
      updateOne: {
        filter: { vendor: vendor.owner, name: p.name },
        update: { $set: doc },
        upsert: true,
      },
    };
  });
};

// ─── Public API ────────────────────────────────────────────────────

// Merge AI-parsed products back into the schema used by groupRowsIntoProducts.
// AI returns cleaner grouping than the rule-based grouper (semantic variants,
// smarter deduplication), so when AI succeeds we prefer it; on failure the
// caller falls back to the local rule-based grouper.
function normalizeAiProducts(aiProducts) {
  return aiProducts
    .filter((p) => p && p.name && Array.isArray(p.variants) && p.variants.length > 0)
    .map((p) => {
      const sourceRows = Array.isArray(p.sourceRows) ? p.sourceRows : [];
      const images = Array.from(new Set((p.images || []).filter((u) => isUrl(u))));
      const variants = p.variants
        .filter((v) => Number.isFinite(v.price) && v.price > 0)
        .map((v) => ({
          options: v.options || {},
          sku: v.sku || undefined,
          stock: coerceNumber(v.stock) || 0,
          price: v.price,
          images: Array.from(new Set((v.images || []).filter((u) => isUrl(u)))),
          compareAtPrice: Number.isFinite(v.compareAtPrice) && v.compareAtPrice > 0 ? v.compareAtPrice : undefined,
          productUrl: v.productUrl || undefined,
        }));

      if (variants.length === 0) return null;

      const prices = variants.map((v) => v.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      const doc = {
        name: String(p.name).trim(),
        category: (p.category && String(p.category).trim()) || 'Uncategorized',
        basePrice: minPrice,
        images,
        sourceRows,
        description: p.description || undefined,
        tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : undefined,
        brand: p.brand || undefined,
      };

      const optionNames = new Set();
      variants.forEach((v) => Object.keys(v.options).forEach((k) => optionNames.add(k)));

      if (optionNames.size > 0) {
        doc.options = Array.from(optionNames).map((optName) => ({
          name: optName,
          values: Array.from(new Set(variants.map((v) => v.options[optName]).filter(Boolean))),
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

module.exports = {
  parseCatalogFile,
  groupRowsIntoProducts,
  buildProductBulkOps,
  normalizeAiProducts,
};
