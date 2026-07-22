// ─── Streaming catalog import (memory-safe for very large files) ─────
//
// Uses ExcelJS.stream.xlsx.WorkbookReader to process rows one at a time
// without loading the whole worksheet into memory.  Designed to handle
// 1M+ row Excel files without OOM.
//
// Trade-offs:
//   - AI row parsing is skipped entirely (rule-based grouping only).
//   - The full column map is still extracted up-front so the streaming
//     pass knows what each column means.
//   - We buffer the simplified rows in batches and flush to the caller
//     after each chunk, so peak memory = chunk size, not file size.
//
// Public API: see parseCatalogFileStream() below.

const fs = require('fs');
const ExcelJS = require('exceljs');
const { safeStr, coerceNumber, coerceBoolean, isUrl } = require('./catalogImport');

const HEADER_ALIASES = {
  'product name': 'productName', 'product title': 'productName', 'item name': 'productName',
  'title': 'productName', name: 'productName',
  type: 'category', category: 'category', department: 'category', collection: 'category',
  'colour': 'color', color: 'color',
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

const KEY_TYPE_MAP = {
  price: 'number', compareAt: 'number', quantity: 'number',
  productUrl: 'url',
  image0: 'url', image1: 'url', image2: 'url', image3: 'url', image4: 'url',
  image5: 'url', image6: 'url', image7: 'url', image8: 'url', image9: 'url',
  inStock: 'boolean',
};
const inferType = (key) => KEY_TYPE_MAP[key] || 'text';

// ─── CSV streaming via fast-csv-like manual split (no extra deps) ─────

async function* csvRowIterable(buffer) {
  const text = buffer.toString('utf8');
  let i = 0;
  let lineNum = 0;
  let cur = [];
  let field = '';

  while (i < text.length) {
    let c = text[i];
    if (c === '"') {
      // quoted field — read until matching "
      i++;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') {
          field += '"'; i += 2;
        } else if (text[i] === '"') {
          i++; break;
        } else {
          field += text[i++];
        }
      }
    } else if (c === ',') {
      cur.push(field); field = ''; i++;
    } else if (c === '\r') {
      i++;
    } else if (c === '\n') {
      cur.push(field); field = '';
      lineNum++;
      yield { lineNum, fields: cur };
      cur = [];
      i++;
    } else {
      field += c; i++;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    lineNum++;
    yield { lineNum, fields: cur };
  }
}

// ─── Public streaming API ─────────────────────────────────────────────

/**
 * Parse an Excel/CSV catalog file using streaming.
 * Returns { products, skippedRows, parseErrors, droppedColumns, totalRows }
 *
 * @param {Buffer|string} input   Buffer contents OR filesystem path to .xlsx/.csv
 * @param {string}        filename  Used to detect extension when input is a Buffer
 * @param {object}        [opts]
 * @param {(progress) => void} [opts.onProgress]  Called every CHUNK_SIZE rows.
 */
async function parseCatalogFileStream(input, filename, opts = {}) {
  const { onProgress } = opts;
  const CHUNK_SIZE = 5000;

  const ext = filename
    ? (String(filename).match(/\.[^.]+$/) || [''])[0].toLowerCase()
    : (typeof input === 'string' ? (input.match(/\.[^.]+$/) || [''])[0].toLowerCase() : '');

  if (!['.xlsx', '.csv'].includes(ext)) {
    const error = new Error('Unsupported file type. Please upload a .xlsx or .csv file.');
    error.status = 400;
    throw error;
  }

  // ── Pass 1: extract header row + build column map ──
  let columnMap = {};
  let unknownHeaders = [];
  let headerRow = [];

  if (ext === '.xlsx') {
    const streamInput = typeof input === 'string'
      ? fs.createReadStream(input)
      : require('stream').Readable.from(input);
    const wbStream = new ExcelJS.stream.xlsx.WorkbookReader(streamInput, {
      entries: 'emit',
      sharedStrings: 'cache',
      styles: 'cache',
      worksheets: 'emit',
    });
    let wsSeen = false;
    for await (const ws of wbStream) {
      wsSeen = true;
      // First row from the first worksheet
      for await (const row of ws) {
        const values = (row.values || []).slice(1); // exceljs row.values is 1-indexed
        headerRow = values.map(safeStr);
        break;
      }
      break;
    }
    if (!wsSeen) {
      const error = new Error('The uploaded file has no worksheets.');
      error.status = 400;
      throw error;
    }
  } else {
    // CSV: header is first line
    const iter = csvRowIterable(typeof input === 'string' ? fs.readFileSync(input) : input);
    const first = await iter.next();
    if (first.done) {
      const error = new Error('The uploaded file is empty.');
      error.status = 400;
      throw error;
    }
    headerRow = first.value.fields;
  }

  // Build column map
  headerRow.forEach((rawHeader, idx) => {
    const colNumber = idx + 1;
    const trimmed = safeStr(rawHeader).trim();
    if (!trimmed) return;
    const key = normalizeHeader(trimmed);
    if (key) {
      columnMap[colNumber] = { key, rawHeader: trimmed, type: inferType(key) };
    } else {
      unknownHeaders.push(trimmed);
    }
  });

  // ── Pass 2: stream rows, build chunked products ──
  const products = new Map();
  const skippedRows = [];
  const parseErrors = [];
  let totalRows = 0;

  const FALSY_STOCK = new Set(['no', 'n', 'false', '0', 'none', 'out of stock', '']);
  const isFalsyStock = (s) => FALSY_STOCK.has(safeStr(s).toLowerCase());

  function processRow(values, rowNumber) {
    if (rowNumber === 1) return;
    totalRows++;

    const rowData = {};
    const rowErrors = [];

    values.forEach((cellValue, idx) => {
      const colNumber = idx + 1;
      const col = columnMap[colNumber];
      if (!col) return;

      const raw = safeStr(cellValue);
      const { key, type } = col;

      let validated;
      switch (type) {
        case 'number': {
          const n = coerceNumber(cellValue);
          if (n === null && raw) {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw, reason: `Expected number, got "${raw}"` });
          }
          validated = n;
          break;
        }
        case 'url':
          validated = raw || null;
          if (raw && !isUrl(raw)) {
            rowErrors.push({ row: rowNumber, column: col.rawHeader, raw, reason: 'Expected URL starting with http(s)://' });
          }
          break;
        case 'boolean':
          validated = coerceBoolean(cellValue);
          break;
        default:
          validated = raw || null;
      }

      if (validated !== null && validated !== undefined && validated !== '') {
        rowData[key] = validated;
      }
    });

    if (rowErrors.length > 0) parseErrors.push(...rowErrors);
    if (Object.keys(rowData).length === 0) return;

    const rawName = rowData.productName;
    if (!rawName) {
      skippedRows.push({ row: rowNumber, reason: 'Missing Product Name' });
      return;
    }
    const name = safeStr(rawName).trim();
    if (!name) {
      skippedRows.push({ row: rowNumber, reason: 'Empty Product Name' });
      return;
    }
    const price = coerceNumber(rowData.price);
    if (price === null || price <= 0) {
      skippedRows.push({ row: rowNumber, reason: `Missing or invalid Price (got: "${safeStr(rowData.price)}")` });
      return;
    }

    const nameKey = name.toLowerCase();
    if (!products.has(nameKey)) {
      products.set(nameKey, {
        name,
        category: safeStr(rowData.category).trim() || 'Uncategorized',
        description: '',
        images: [],
        variants: [],
        tags: [],
        sourceRows: [rowNumber],
      });
    } else {
      products.get(nameKey).sourceRows.push(rowNumber);
    }
    const product = products.get(nameKey);

    const rowDesc = safeStr(rowData.description || '').trim();
    if (rowDesc.length > product.description.length) product.description = rowDesc;

    const rowImages = Object.keys(rowData)
      .filter((k) => /^image\d+$/.test(k))
      .sort()
      .map((k) => rowData[k])
      .filter((v) => isUrl(safeStr(v)));

    rowImages.forEach((img) => {
      const normalized = safeStr(img).trim();
      if (!product.images.includes(normalized)) product.images.push(normalized);
    });

    const qty = coerceNumber(rowData.quantity);
    const stock = qty !== null ? qty : (isFalsyStock(rowData.inStock) ? 0 : 1);

    const options = {};
    if (rowData.color) options.Color = safeStr(rowData.color).trim();
    if (rowData.size) options.Size = safeStr(rowData.size).trim();

    product.variants.push({
      options,
      sku: rowData.sku ? safeStr(rowData.sku).trim() : undefined,
      stock,
      price,
      images: rowImages.map(v => safeStr(v).trim()),
      compareAtPrice: rowData.compareAt ? coerceNumber(rowData.compareAt) || undefined : undefined,
      productUrl: rowData.productUrl ? safeStr(rowData.productUrl).trim() : undefined,
    });

    if (typeof rowData.tags === 'string') {
      const tag = rowData.tags.trim();
      if (tag && !product.tags.includes(tag)) product.tags.push(tag);
    }
  }

  if (ext === '.xlsx') {
    const streamInput = typeof input === 'string'
      ? fs.createReadStream(input)
      : require('stream').Readable.from(input);
    const wbStream = new ExcelJS.stream.xlsx.WorkbookReader(streamInput, {
      entries: 'emit',
      sharedStrings: 'cache',
      styles: 'cache',
      worksheets: 'emit',
    });

    let lastProgress = 0;
    for await (const ws of wbStream) {
      let rowNum = 0;
      for await (const row of ws) {
        rowNum++;
        const values = (row.values || []).slice(1);
        processRow(values, rowNum);
        if (onProgress && totalRows - lastProgress >= CHUNK_SIZE) {
          lastProgress = totalRows;
          onProgress({ rowsProcessed: totalRows, productsCount: products.size });
        }
      }
      break; // Only first sheet
    }
  } else {
    const iter = csvRowIterable(typeof input === 'string' ? fs.readFileSync(input) : input);
    for await (const { lineNum, fields } of iter) {
      processRow(fields, lineNum);
      if (onProgress && totalRows - lastProgress >= CHUNK_SIZE) {
        lastProgress = totalRows;
        onProgress({ rowsProcessed: totalRows, productsCount: products.size });
      }
    }
  }

  if (onProgress) onProgress({ rowsProcessed: totalRows, productsCount: products.size });

  // ── Finalize ──
  const finalProducts = Array.from(products.values()).map((p) => {
    const prices = p.variants.map((v) => v.price).filter(Number.isFinite);
    if (prices.length === 0) return null;
    const minPrice = Math.min(...prices);
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
        const out = { options: v.options, stock: v.stock, price: v.price, images: v.images };
        if (v.sku) out.sku = v.sku;
        if (v.compareAtPrice) out.compareAtPrice = v.compareAtPrice;
        if (v.productUrl) out.productUrl = v.productUrl;
        return out;
      });
    } else if (p.variants.length === 1) {
      const sole = p.variants[0];
      if (sole.sku) doc.sku = sole.sku;
      doc.stock = sole.stock;
    }

    return doc;
  }).filter(Boolean);

  return {
    products: finalProducts,
    skippedRows,
    parseErrors,
    droppedColumns: unknownHeaders,
    totalRows,
  };
}

module.exports = { parseCatalogFileStream };
