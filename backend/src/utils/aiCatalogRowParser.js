// ─── AI-powered row parser for Excel catalog imports ──────────────────
// Sends normalized row data to OpenAI (gpt-4o-mini by default) to produce
// structured product objects.  Falls back gracefully on any failure.
//
// Batches rows into groups of 30 to keep token usage predictable.
// One API call per batch, not per row.

const { isKeyAvailable, getClient } = require('./aiCatalogParser');

const AI_MODEL = process.env.CATALOG_AI_MODEL || 'gpt-4o-mini';
const BATCH_SIZE = 30;

const FIELD_DESCRIPTIONS = {
  productName: 'Product title/name (string)',
  category: 'Category or collection (string)',
  color: 'Color variant value (string or null)',
  size: 'Size variant value (string or null)',
  price: 'Selling price as a positive number (required per variant)',
  compareAt: 'Original/MRP price as a number, or null if not provided',
  sku: 'SKU/item code string, or null',
  inStock: 'Boolean — true if in stock, false if out',
  quantity: 'Stock quantity number, or null',
  productUrl: 'Full URL starting with https://, or null',
  description: 'Product description text, or null',
  brand: 'Brand name, or null',
  tags: 'Array of tag strings, or empty array',
};

function buildSystemPrompt() {
  const fields = Object.entries(FIELD_DESCRIPTIONS)
    .map(([key, desc]) => `  - "${key}": ${desc}`)
    .join('\n');

  return `You are a product data parser.  Given raw spreadsheet rows with their mapped column keys, produce clean, structured product objects.

Return a JSON object with this shape:
{
  "products": [
    {
      "name": "...",
      "category": "...",
      "description": "...",
      "images": ["https://..."],
      "brand": "...",
      "tags": ["..."],
      "sourceRows": [2, 3],
      "variants": [
        {
          "options": {"Color": "Red", "Size": "M"},
          "sku": "...",
          "stock": 10,
          "price": 299,
          "compareAtPrice": 599,
          "productUrl": "https://..."
        }
      ]
    }
  ],
  "skipped": [{"reason": "...", "row": 7}]
}

Field reference:
${fields}

Rules:
- GROUP rows that share the same product name into one product with multiple variants.
- Include "sourceRows": the list of "__row" numbers that were grouped into this product.
- Each variant MUST have a positive "price" number.  If price is missing or not a positive number, skip that row.
- "stock": use the quantity number if present, otherwise 1 if inStock=true, 0 if inStock=false.
- "options": only include keys that have a value (Color, Size, etc.).
- Deduplicate image URLs.
- If a row has no productName, skip it and add to "skipped" with its "__row" number.
- Keep descriptions as the longest meaningful text found across rows for the same product.
- Preserve original casing for names, brands, tags.
- Return ONLY valid JSON — no markdown, no explanation.`;
}

function buildUserContent(columnMap, rows) {
  const headerInfo = Object.entries(columnMap)
    .map(([colNum, col]) => `Column ${colNum} (${col.key})`)
    .join(', ');

  // Strip __row (internal metadata) and number rows sequentially for the AI
  const rowsJson = rows.map((row, idx) => {
    const simplified = { __row: row.__row || idx + 2 };
    for (const [key, value] of Object.entries(row)) {
      if (key === '__row') continue;
      if (value !== null && value !== undefined && value !== '') {
        simplified[key] = value;
      }
    }
    return simplified;
  });

  return `Columns: ${headerInfo}

Each row has a "__row" field indicating its original spreadsheet row number.

Rows:
${JSON.stringify(rowsJson, null, 2)}`;
}

// ─── Parse a batch of rows via AI ────────────────────────────────────

async function aiParseBatch(columnMap, rows) {
  if (!isKeyAvailable()) return null;
  if (rows.length === 0) return null;

  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserContent(columnMap, rows) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 8192,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    // Validate shape
    if (!parsed || !Array.isArray(parsed.products)) return null;

    return parsed;
  } catch {
    // Any AI failure → fall back to local parser
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

// columnMap: { colNumber: { key, rawHeader, type } } from discoverSchema
// rows: array of { key: value } row objects (already extracted from cells)
// Returns: { products, skippedRows, parseErrors, usedAI } or null on failure
async function aiParseRows(columnMap, rows) {
  if (!isKeyAvailable()) return null;
  if (rows.length === 0) return null;

  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  const allProducts = [];
  const allSkipped = [];
  let failed = false;

  for (const batch of batches) {
    const result = await aiParseBatch(columnMap, batch);
    if (!result) {
      failed = true;
      continue; // Skip this batch, try the next one
    }

    if (Array.isArray(result.products)) {
      allProducts.push(...result.products);
    }
    if (Array.isArray(result.skipped)) {
      allSkipped.push(...result.skipped);
    }
  }

  if (allProducts.length === 0 && failed) return null; // All batches failed → fall back

  return {
    products: allProducts,
    skippedRows: allSkipped,
    parseErrors: [],
    usedAI: true,
  };
}

module.exports = { aiParseRows, BATCH_SIZE };
