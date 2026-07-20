// ─── AI-powered column mapping for Excel catalog imports ──────────
// This is the PRIMARY path for column mapping.  gpt-4o-mini receives
// every column header + sample values and returns the best mapping.
//
// The fuzzy CONTAINS_MAP in catalogImport.js is only a degraded
// fallback when OPENAI_API_KEY is missing or the API call fails.
//
// One API call per file, not per row.

const AI_MODEL = 'gpt-4o-mini';
const MAX_SAMPLE_ROWS = 5;

const KNOWN_FIELDS = {
  productName: 'Product title or name',
  category: 'Product category, department, or collection',
  color: 'Product color or colour',
  size: 'Product size (S, M, L, XL, numeric)',
  price: 'Selling price (numeric, may include currency symbol or decimals)',
  compareAt: 'Original/compare-at price, or MRP (numeric, higher than price)',
  sku: 'SKU, item code, or product code (alphanumeric)',
  inStock: 'Stock availability (yes/no, true/false, in stock/out of stock)',
  quantity: 'Stock quantity (numeric count)',
  productUrl: 'Product URL or link (starts with http:// or https://)',
  description: 'Product description, details, or long free-text',
  brand: 'Brand or vendor/manufacturer name',
  tags: 'Product tags or keywords (comma-separated or multiple values)',
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

  return `You map Excel column headers to canonical field keys for a product import tool.

Given column headers and sample cell values, return a JSON object mapping EACH header to one of:

${fields}

  - "image0", "image1", …: Product image URL columns (use "image" as the key prefix).

Rules:
- Base your decision on the HEADER NAME and the SAMPLE VALUES.
- "Item Name" with values like "Cotton Tee" → productName.
- "Farbe" with values like "Rot" → color.
- "Größe" with values like "M, L, XL" → size.
- "Preis" or "Price (₹)" with values like "499" or "₹1,200" → price.
- "Verfügbar" with values like "Ja/Nein" → inStock.
- "Lager" or "Stock" with numeric values → quantity.
- A column whose values are clearly image URLs → image (assign sequential slots image0, image1…).
- A column whose values are product URLs → productUrl.
- If a column does NOT match any known field, map it to null.
- Return ONLY a JSON object — no markdown, no explanation.
- Every single header MUST appear as a key in the output object.`;
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
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserContent(columnsWithSamples) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 2048,
    });
    rawResponse = response.choices?.[0]?.message?.content;
    if (!rawResponse) return {};
  } catch {
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
