// ─── AI-powered column mapping for Excel catalog imports ──────────
// PRIMARY path: OpenAI returns the best mapping for non-standard headers.
// FALLBACK: fuzzy CONTAINS_MAP in catalogImport.js (when key missing or call fails).
//
// One API call per file, not per row. Cost: ~$0.0001 per file at gpt-4.1-nano rates.

const AI_MODEL = process.env.OPENAI_CATALOG_MODEL || 'gpt-4.1-nano';
const MAX_SAMPLE_ROWS = 5;
const REQUEST_TIMEOUT_MS = 15000;

const KNOWN_FIELDS = {
  productName: 'Product title or name (the primary product identifier)',
  category: 'Product category, department, collection, or type',
  color: 'Product color or colour',
  size: 'Product size (S, M, L, XL, or numeric)',
  price: 'Selling price (numeric, may include currency symbol or thousands separators)',
  compareAt: 'Original/compare-at price, MRP, or list price (numeric, HIGHER than selling price)',
  sku: 'SKU, item code, product code, or style number (alphanumeric)',
  inStock: 'Stock availability (yes/no, true/false, in stock/out of stock)',
  quantity: 'Stock quantity or count (numeric)',
  productUrl: 'Product URL or link (starts with http:// or https://)',
  description: 'Product description, details, or long free-text',
  brand: 'Brand, vendor, or manufacturer name',
  tags: 'Product tags or keywords (comma-separated or repeated values)',
};

let _openai;

function getClient() {
  if (!_openai) {
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

function isKeyAvailable() {
  return !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-your-'));
}

function collectSamples(worksheet, colNumber) {
  const samples = [];
  for (let rowNum = 2; rowNum <= Math.min(1 + MAX_SAMPLE_ROWS, worksheet.rowCount); rowNum++) {
    const cell = worksheet.getRow(rowNum).getCell(colNumber);
    if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
      samples.push(String(cell.value).trim().slice(0, 120));
    }
  }
  return samples;
}

function buildSystemPrompt() {
  const fields = Object.entries(KNOWN_FIELDS)
    .map(([key, desc]) => `  - "${key}": ${desc}`)
    .join('\n');

  return `You are a column header mapper. Your only job: map Excel column headers to canonical field keys.

Valid field keys:
${fields}

  "image0", "image1", …: image URL columns.

CRITICAL RULES:
- Look at the HEADER NAME first, then the sample values.
- "Title", "Item", "Name" alone → productName. "Selling Price", "Cost", "Retail" → price. "MRP", "Original Price" → compareAt.
- Numeric columns → price, compareAt, sku, quantity, inStock. URL columns → productUrl. Free-text → description, brand, category, tags.
- "Item Code", "Style No", "SKU#" → sku.
- If genuinely unsure, return null. Never guess.
- Output ONLY a JSON object: { "Exact Header String": "fieldKeyOrNull", ... }`;
}

function buildUserContent(allColumns) {
  const lines = allColumns.map(({ rawHeader, samples }) => {
    const sampleText = samples.length > 0
      ? `  values: ${samples.map(s => JSON.stringify(s)).join(', ')}`
      : '  (no data)';
    return `"${rawHeader}"\n${sampleText}`;
  });
  return lines.join('\n') + '\n\nReturn a JSON object mapping EACH header to a field key or null.';
}

// ─── Public API ───────────────────────────────────────────────────

// allColumns: [{ colNumber, rawHeader }]
// Returns: { colNumber: "fieldKey" } for AI-mapped columns, or {} on failure.
async function aiEnhanceSchema(worksheet, allColumns) {
  if (!isKeyAvailable()) return {};
  if (allColumns.length === 0) return {};

  const columnsWithSamples = allColumns.map((col) => ({
    colNumber: col.colNumber,
    rawHeader: col.rawHeader,
    samples: collectSamples(worksheet, col.colNumber),
  }));

  let rawResponse;
  try {
    const openai = getClient();
    const startTime = Date.now();
    console.log(`[catalogImport] AI mapping started: model=${AI_MODEL}, headers=${allColumns.length}, key=${process.env.OPENAI_API_KEY.slice(0, 7)}...`);
    const response = await Promise.race([
      openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserContent(columnsWithSamples) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 2048,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`OpenAI timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
      ),
    ]);
    rawResponse = response.choices?.[0]?.message?.content;
    const elapsed = Date.now() - startTime;
    if (!rawResponse) {
      console.log(`[catalogImport] AI mapping: empty response from OpenAI (${elapsed}ms)`);
      return {};
    }
    console.log(`[catalogImport] AI mapping succeeded in ${elapsed}ms`);
  } catch (err) {
    console.warn(`[catalogImport] AI mapping failed, falling back to fuzzy: ${err.message}`);
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return {};
  }

  // Build mapping: only accept known fields or "image" prefix.
  const mapping = {};
  let nextSlot = 0;

  for (const col of allColumns) {
    const aiKey = parsed[col.rawHeader];
    if (!aiKey) continue;

    if (KNOWN_FIELDS[aiKey]) {
      mapping[col.colNumber] = aiKey;
    } else if (/^image\d*$/i.test(aiKey)) {
      // Assign sequential image slots regardless of AI numbering.
      mapping[col.colNumber] = `image${nextSlot++}`;
    } else if (aiKey.startsWith('image') || aiKey.startsWith('Image')) {
      // Handle "image0", "Image1", etc. from AI
      mapping[col.colNumber] = `image${nextSlot++}`;
    }
  }

  return mapping;
}

module.exports = { aiEnhanceSchema, KNOWN_FIELDS };
