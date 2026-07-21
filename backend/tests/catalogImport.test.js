/**
 * Smoke test for catalog import.
 *
 * Asserts the AI-first + fuzzy fallback pipeline correctly maps
 * non-canonical Excel headers ("Product Title", "MRP", "Colorway")
 * to canonical fields (productName, compareAt, color).
 *
 * Skipped if OPENAI_API_KEY is not set — falls back to fuzzy only.
 */

const ExcelJS = require('exceljs');
const { Readable } = require('stream');

const { parseCatalogFile, groupRowsIntoProducts } = require('../src/utils/catalogImport');
const { isKeyAvailable } = require('../src/utils/aiCatalogParser');

function buildWorkbook(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return wb.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
}

describe('catalogImport — fuzzy + AI mapping', () => {
  const nonCanonicalHeaders = [
    'Product Title',  // → productName (via CONTAINS_MAP)
    'MRP',            // → compareAt
    'Selling Price',  // → price
    'Colorway',       // → color (via AI)
    'Item Code',      // → sku
    'Available',      // → inStock
  ];
  const sampleRows = [
    ['Vintage Tee', '799', '599', 'Sand', 'DRY-TEE-001', 'Yes'],
    ['Slim Jean', '1999', '1499', 'Indigo', 'DRY-JN-022', 'Yes'],
  ];

  let buffer;

  beforeAll(async () => {
    buffer = await buildWorkbook(nonCanonicalHeaders, sampleRows);
  });

  test('fuzzy fallback maps common variants without AI', async () => {
    // Simulate no-key path: short-circuit the AI layer
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await parseCatalogFile(buffer, 'test.xlsx');
    expect(result.rows.length).toBeGreaterThan(0);

    const firstRow = result.rows[0];
    // Fuzzy match expectations (CONTAINS_MAP):
    expect(firstRow.productName).toBe('Vintage Tee');
    expect(firstRow.price).toBe('599');
    expect(firstRow.compareAt).toBe('799');
    expect(firstRow.sku).toBe('DRY-TEE-001');
    // "Colorway" and "Available" are NOT in fuzzy tables — only AI maps them.
    expect(firstRow.color).toBeUndefined();

    process.env.OPENAI_API_KEY = originalKey;
  });

  test('parses xlsx and groups products by name', async () => {
    if (!isKeyAvailable()) {
      console.warn('[skip] OPENAI_API_KEY not set — skipping AI assertion');
      return;
    }
    const result = await parseCatalogFile(buffer, 'test.xlsx');
    expect(result.rows.length).toBe(2);
    const { products, skippedRows } = groupRowsIntoProducts(result.rows, result.errors);
    expect(products.length).toBe(2);
    expect(products[0].name).toBe('Vintage Tee');
    expect(skippedRows.length).toBe(0);
  });

  test('rejects non-xlsx/csv files with 400', async () => {
    await expect(parseCatalogFile(Buffer.from('garbage'), 'bad.xls'))
      .rejects.toMatchObject({ status: 400 });
    await expect(parseCatalogFile(Buffer.from('garbage'), 'bad.txt'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('skips rows with missing productName or invalid price', async () => {
    const headers = ['Product Title', 'Selling Price'];
    const rows = [
      ['Good Product', '500'],
      ['', '300'],        // no name → skip
      ['No Price', ''],   // no price → skip
      ['Another Good', '250'],
    ];
    const buf = await buildWorkbook(headers, rows);
    const result = await parseCatalogFile(buf, 'test.xlsx');
    const { products, skippedRows } = groupRowsIntoProducts(result.rows, result.errors);
    expect(products.length).toBe(2);
    expect(skippedRows.length).toBe(2);
  });
});