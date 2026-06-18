/**
 * excelImport.js — bulk product import from Excel/CSV.
 *
 * Phase 3A. Used by POST /api/products/import.
 *
 * Why a utility + a route, not just one big handler: tests can drive
 * the parser against a Buffer without going through multer/Express.
 *
 * Expected sheet (case-insensitive header names, first row is header):
 *
 *   name | brand | category | basePrice | stock | description | tags | images | sku
 *
 * Variants aren't supported in the spreadsheet — they're a complex
 * shape (option matrix) and most vendors have ≤ 5 variants per product.
 * If a vendor needs variants, the existing POST /api/products endpoint
 * accepts them in the JSON body.
 *
 * Result per row:
 *   { row, ok, error?, productId? }
 *
 * Result is always 200 with the per-row details. The client renders
 * "Imported N/M, here's what failed" — a 4xx/5xx would force the
 * client to re-implement the partial-success logic.
 */

const XLSX = require('xlsx');
const { create: productCreateSchema } = require('../schemas/products');

const HEADER_ALIASES = {
  name: ['name', 'product', 'title'],
  brand: ['brand', 'brand name'],
  category: ['category', 'type'],
  basePrice: ['baseprice', 'price', 'cost'],
  stock: ['stock', 'inventory', 'qty', 'quantity'],
  description: ['description', 'desc', 'details'],
  tags: ['tags', 'keywords'],
  images: ['images', 'image urls', 'photos'],
  sku: ['sku', 'code'],
};

function normalizeHeader(h) {
  const lower = String(h || '').trim().toLowerCase();
  for (const [canon, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(lower)) return canon;
  }
  return null;
}

function coerceRow(rawRow) {
  // rawRow is the row as xlsx gives us: { 'Name': 'Tee', 'Brand': 'Zara', ... }
  const out = {};
  for (const [k, v] of Object.entries(rawRow)) {
    const canon = normalizeHeader(k);
    if (!canon) continue;
    out[canon] = v;
  }
  // Type coercion
  if (out.basePrice !== undefined) {
    const n = Number(out.basePrice);
    out.basePrice = Number.isFinite(n) ? n : out.basePrice;
  }
  if (out.stock !== undefined) {
    const n = parseInt(out.stock, 10);
    out.stock = Number.isFinite(n) ? n : 0;
  }
  if (typeof out.tags === 'string') {
    out.tags = out.tags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof out.images === 'string') {
    out.images = out.images.split(/[\n,;|]/).map((u) => u.trim()).filter(Boolean);
  }
  // Mongoose needs _id/vendor on the schema; vendor is supplied by the
  // route, _id is auto-generated. We strip both from the spreadsheet
  // input to prevent override.
  delete out._id;
  delete out.vendor;
  return out;
}

async function parseAndValidate(buffer, vendorId, opts = {}) {
  const { dryRun = false, maxRows = 1000 } = opts;
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], errors: [{ row: 0, ok: false, error: 'No sheet found' }] };

  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  const results = [];
  const errors = [];

  for (let i = 0; i < raw.length && i < maxRows; i++) {
    const rowNum = i + 2; // +2 = 1-indexed + header
    const coerced = coerceRow(raw[i]);
    coerced.vendor = vendorId;
    const parsed = productCreateSchema.safeParse(coerced);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ');
      const r = { row: rowNum, ok: false, error: msg };
      results.push(r);
      errors.push(r);
      continue;
    }
    if (dryRun) {
      results.push({ row: rowNum, ok: true, dryRun: true });
    } else {
      try {
        const Product = require('../models/Product');
        const p = await Product.create(parsed.data);
        results.push({ row: rowNum, ok: true, productId: p._id.toString() });
      } catch (e) {
        const r = { row: rowNum, ok: false, error: e.message };
        results.push(r);
        errors.push(r);
      }
    }
  }
  return { rows: results, errors };
}

module.exports = { parseAndValidate, normalizeHeader, coerceRow };