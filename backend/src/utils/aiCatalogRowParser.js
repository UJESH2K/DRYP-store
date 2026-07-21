// ─── AI-powered row parser for Excel catalog imports ──────────────────
// PRIMARY path: sends row data + column mappings to OpenAI for intelligent
// parsing, grouping, and structuring.  Falls back gracefully on any failure.
//
// Batches rows into groups of 30.  One API call per batch, not per row.

const { isKeyAvailable, getClient } = require('./aiCatalogParser');

const AI_MODEL = process.env.CATALOG_AI_MODEL || 'gpt-4o-mini';
const BATCH_SIZE = 30;

function buildSystemPrompt() {
  return `You are a robust product catalog importer.  Your job is to read raw spreadsheet rows with column-key mappings and produce clean, structured product objects — even when the data is messy, incomplete, or has unexpected column names.

CRITICAL RULES:
- Be TOLERANT of missing fields.  If a column mapping exists but the value is absent, just skip it — never crash or refuse to parse.
- Be SMART about column names.  "Item", "Prod", "Name/Title", "Product", "Artikel" all mean productName.  "Cat", "Dept", "Collection", "Type" all mean category.  "Clr", "Shade", "Hue" mean color.  "Qty", "Units", "Stock Level" mean quantity.  "₹", "Rs", "Cost", "Rate" mean price.
- Each row is a VARIANT of a product.  Multiple rows with the same productName → one product with multiple variants.
- If price is missing or not a positive number for a row, SKIP that row (add to "skipped" with the row number).
- Stock: use quantity if present; otherwise 1 if inStock=true, 0 if inStock=false.
- Variant "options": only include keys with actual values (e.g., {"Color": "Red", "Size": "M"}).
- Deduplicate image URLs.
- Descriptions: take the longest meaningful text across rows for the same product.
- Preserve original casing for names, brands, tags.
- If a row has no recognizable product name, skip it.
- You may see columns you don't recognize — just include them in the output as-is in an "extra" field if needed, but focus on the known fields.

OUTPUT FORMAT — Return ONLY this JSON shape:
{
  "products": [
    {
      "name": "string",
      "category": "string or null",
      "description": "string or null",
      "images": ["https://..."],
      "brand": "string or null",
      "tags": ["string"],
      "sourceRows": [2, 3],
      "variants": [
        {
          "options": {"Color": "Red", "Size": "M"},
          "sku": "string or null",
          "stock": 10,
          "price": 299,
          "compareAtPrice": 599,
          "productUrl": "https://..."
        }
      ]
    }
  ],
  "skipped": [{"row": 7, "reason": "Missing price"}]
}

Return ONLY valid JSON — no markdown, no explanation text before or after.`;
}

function buildUserContent(columnMap, rows) {
  const headerInfo = Object.entries(columnMap)
    .map(([colNum, col]) => `  Col ${colNum} → ${col.key}  (header: "${col.rawHeader}")`)
    .join('\n');

  const rowsJson = rows.map((row) => {
    const simplified = { __row: row.__row };
    for (const [key, value] of Object.entries(row)) {
      if (key === '__row') continue;
      if (value !== null && value !== undefined && value !== '') {
        simplified[key] = value;
      }
    }
    return simplified;
  });

  return `Column mappings (column number → field key):
${headerInfo}

Each row has "__row" (original spreadsheet row number).  Parse all rows:

${JSON.stringify(rowsJson, null, 2)}`;
}

// ─── Parse a single batch via AI ────────────────────────────────────

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
    if (!parsed || !Array.isArray(parsed.products)) return null;

    return parsed;
  } catch {
    return null; // Any failure → signal caller to skip this batch
  }
}

// ─── Public API ──────────────────────────────────────────────────────

// columnMap: { colNumber: { key, rawHeader, type } } from discoverSchema
// rows: array of { key: value } row objects (with __row metadata)
//
// Returns: { products, skippedRows, parseErrors, usedAI } or null on failure.
//   Returns null only if ALL batches fail or no API key — caller falls back.
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
      continue; // Skip bad batch, keep going
    }

    if (Array.isArray(result.products)) {
      allProducts.push(...result.products);
    }
    if (Array.isArray(result.skipped)) {
      allSkipped.push(...result.skipped);
    }
  }

  // Only fall back if every single batch failed
  if (allProducts.length === 0 && failed) return null;

  return {
    products: allProducts,
    skippedRows: allSkipped,
    parseErrors: [],
    usedAI: true,
  };
}

module.exports = { aiParseRows, BATCH_SIZE };
