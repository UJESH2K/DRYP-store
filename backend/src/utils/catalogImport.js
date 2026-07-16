const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { normalizeImageKeys } = require('./imageUrls');

const HEADER_ALIASES = {
  'product name': 'productName',
  name: 'productName',
  type: 'category',
  category: 'category',
  colour: 'color',
  color: 'color',
  size: 'size',
  price: 'price',
  'price (inr)': 'price',
  'compare-at': 'compareAt',
  'compare-at (inr)': 'compareAt',
  'compare at': 'compareAt',
  sku: 'sku',
  'in stock?': 'inStock',
  'in stock': 'inStock',
  quantity: 'quantity',
  'product url': 'productUrl',
};

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.csv']);

const normalizeHeader = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  const imageMatch = key.match(/^image\s*(\d+)$/);
  if (imageMatch) return `image${imageMatch[1]}`;
  return null; // Unrecognized column — ignored rather than failing the whole import.
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
    const name = row.productName;
    const price = Number(row.price);

    if (!name) {
      skippedRows.push({ row: row.__row, reason: 'Missing Product Name' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      skippedRows.push({ row: row.__row, reason: 'Missing or invalid Price' });
      return;
    }

    if (!products.has(name)) {
      products.set(name, { name, category: row.category || 'Uncategorized', images: [], variants: [] });
    }
    const product = products.get(name);

    const rowImages = Object.keys(row)
      .filter((k) => /^image\d+$/.test(k))
      .sort()
      .map((k) => row[k])
      .filter(Boolean);
    rowImages.forEach((img) => {
      if (!product.images.includes(img)) product.images.push(img);
    });

    const inStock = String(row.inStock || '').trim().toLowerCase();
    const stock = inStock === 'no' ? 0 : Number(row.quantity) || 0;

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

  return { products: result, skippedRows, droppedColumns };
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
