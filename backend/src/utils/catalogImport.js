const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { normalizeImageKeys } = require('./imageUrls');

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

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.csv']);

const coerceNumber = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw || '').replace(/[^0-9.\-]/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const isFalsyStock = (s) => {
  const v = String(s || '').trim().toLowerCase();
  return ['', 'no', 'n', 'false', '0', 'none', 'out of stock'].includes(v);
};

const normalizeHeader = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];

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
  for (const [substr, canonical] of CONTAINS_MAP) {
    if (key.includes(substr)) return canonical;
  }

  const imageMatch = key.match(/^image\s*(\d+)$/);
  if (imageMatch) return `image${imageMatch[1]}`;
  return null;
};

const cellText = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('').trim();
    if (value.hyperlink) return String(value.hyperlink).trim();
  }
  return String(value).trim();
};

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

  const columnKeys = {};
  const unknownHeaders = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = cell.value;
    const key = normalizeHeader(raw);
    if (key) {
      columnKeys[colNumber] = key;
    } else if (raw) {
      unknownHeaders.push(String(raw).trim());
    }
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = columnKeys[colNumber];
      if (key) rowData[key] = cellText(cell.value);
    });
    if (Object.keys(rowData).length > 0) {
      rowData.__row = rowNumber;
      rows.push(rowData);
    }
  });

  return { rows, unknownHeaders };
}

// Groups flat rows (one row per Colour/Size combo) into DRYP product drafts.
// Does not set `vendor`/`brand`/`source` — the caller fills those in once the
// target vendor is known (preview happens before a vendor may be selected).
const groupRowsIntoProducts = (rows) => {
  const products = new Map();
  const skippedRows = [];

  rows.forEach((row) => {
    const rawName = row.productName;
    if (!rawName) {
      skippedRows.push({ row: row.__row, reason: 'Missing Product Name' });
      return;
    }
    const name = rawName.trim();
    const price = coerceNumber(row.price);

    if (!Number.isFinite(price) || price <= 0) {
      skippedRows.push({ row: row.__row, reason: 'Missing or invalid Price' });
      return;
    }

    // ponytail: case-insensitive dedup, preserve first-seen casing
    const nameKey = name.toLowerCase();
    if (!products.has(nameKey)) {
      products.set(nameKey, { name, category: row.category || 'Uncategorized', images: [], variants: [] });
    }
    const product = products.get(nameKey);

    const rowImages = Object.keys(row)
      .filter((k) => /^image\d+$/.test(k))
      .sort()
      .map((k) => row[k])
      .filter(Boolean);
    rowImages.forEach((img) => {
      if (!product.images.includes(img)) product.images.push(img);
    });

    const stock = row.quantity !== undefined
      ? coerceNumber(row.quantity) || 0
      : isFalsyStock(row.inStock) ? 0 : 1;

    const options = {};
    if (row.color) options.Color = row.color;
    if (row.size) options.Size = row.size;

    product.variants.push({
      options,
      sku: row.sku || undefined,
      stock,
      price,
      images: rowImages,
      compareAtPrice: row.compareAt ? Number(row.compareAt) || undefined : undefined,
      productUrl: row.productUrl || undefined,
    });
  });

  const result = Array.from(products.values()).map((p) => {
    const optionNames = new Set();
    p.variants.forEach((v) => Object.keys(v.options).forEach((k) => optionNames.add(k)));
    const prices = p.variants.map((v) => v.price);

    if (prices.length === 0 || prices.every((p) => !Number.isFinite(p))) {
      return null;
    }

    const validPrices = prices.filter(Number.isFinite);
    const doc = {
      name: p.name,
      category: p.category,
      basePrice: Math.min(...validPrices),
      images: p.images,
      preview: {
        variantCount: p.variants.length,
        priceRange: [Math.min(...validPrices), Math.max(...validPrices)],
        compareAtPrice: p.variants.find((v) => v.compareAtPrice)?.compareAtPrice,
        productUrl: p.variants.find((v) => v.productUrl)?.productUrl,
      },
    };

    if (optionNames.size > 0) {
      doc.options = Array.from(optionNames).map((optName) => ({
        name: optName,
        values: Array.from(new Set(p.variants.map((v) => v.options[optName]).filter(Boolean))),
      }));
      doc.variants = p.variants.map((v) => {
        const variant = { options: v.options, stock: v.stock, price: v.price, images: v.images };
        if (v.sku) variant.sku = v.sku;
        return variant;
      });
    } else if (p.variants.length === 1) {
      if (p.variants[0].sku) doc.sku = p.variants[0].sku;
      doc.stock = p.variants[0].stock;
    }

    return doc;
  });

  return { products: result, skippedRows };
};

// Turns reviewed product drafts (from groupRowsIntoProducts, possibly edited by
// the admin/vendor in the UI) into Product.bulkWrite ops for a specific vendor.
// Upserts on {vendor, name} so re-importing the same file updates in place.
const buildProductBulkOps = (vendor, products) => {
  return products.map((p) => {
    const doc = {
      name: p.name,
      category: p.category || 'Uncategorized',
      basePrice: p.basePrice,
      images: normalizeImageKeys(p.images || []),
      brand: vendor.name,
      vendor: vendor.owner,
      source: 'manual_import',
    };
    if (p.description) doc.description = p.description;
    if (Array.isArray(p.tags)) doc.tags = p.tags;
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

module.exports = { parseCatalogFile, groupRowsIntoProducts, buildProductBulkOps };
