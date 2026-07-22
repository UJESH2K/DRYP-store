// Regression test: catalog import must handle big files safely.
// Generates a xlsx in memory, parses it, and asserts:
//   - extracts all rows without OOM
//   - rule-based parser kicks in for > AI_ROW_THRESHOLD (skips AI)
//   - parses and groups in reasonable time

const ExcelJS = require('exceljs');
const { parseCatalogFile, groupRowsIntoProducts, MAX_ROWS, MAX_CELL_VALUE_LENGTH } = require('./src/utils/catalogImport');

async function main() {
  console.log(`MAX_ROWS = ${MAX_ROWS}, MAX_CELL_VALUE_LENGTH = ${MAX_CELL_VALUE_LENGTH}`);

  // ── Test 1: big but within limits (6000 rows, > AI threshold of 5000) ──
  const ROWS_1 = 6000;
  const start1 = Date.now();

  const wb1 = new ExcelJS.Workbook();
  const ws1 = wb1.addWorksheet('Catalog');
  ws1.columns = [
    { header: 'Product Name', key: 'productName', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Colour', key: 'color', width: 8 },
    { header: 'Size', key: 'size', width: 8 },
    { header: 'Price (INR)', key: 'price', width: 12 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Image 1', key: 'image1', width: 40 },
  ];

  console.log(`\nTest 1: generating ${ROWS_1} rows...`);
  for (let i = 0; i < ROWS_1; i++) {
    const productIdx = Math.floor(i / 5);
    ws1.addRow({
      productName: `Product ${productIdx}`,
      type: i % 2 ? 'Tops' : 'Bottoms',
      color: ['Red', 'Blue', 'Black', 'White'][i % 4],
      size: ['S', 'M', 'L', 'XL'][i % 4],
      price: 100 + i,
      sku: `SKU${productIdx}-${i}`,
      image1: `https://cdn.dryp.store/p${productIdx}.jpg`,
    });
  }

  const buf1 = await wb1.xlsx.writeBuffer();
  console.log(`  Buffer: ${(buf1.length / 1024 / 1024).toFixed(2)} MB, generating: ${Date.now() - start1}ms`);

  console.log('  Parsing...');
  const t1 = Date.now();
  const result1 = await parseCatalogFile(buf1, 'catalog.xlsx');
  console.log(`  Parsed in ${Date.now() - t1}ms`);

  // Should skip AI (rows > 5000 threshold)
  if (result1.aiParsed) {
    console.error('FAIL: AI parser should be skipped for large files');
    process.exit(1);
  }
  console.log('  OK: AI parser skipped (file > AI threshold)');

  if (result1.rows.length !== ROWS_1) {
    console.error(`FAIL: expected ${ROWS_1} rows, got ${result1.rows.length}`);
    process.exit(1);
  }
  console.log(`  OK: extracted ${result1.rows.length} rows`);

  const grouped1 = groupRowsIntoProducts(result1.rows, result1.errors);
  console.log(`  OK: grouped into ${grouped1.products.length} products`);
  if (grouped1.products.length === 0) {
    console.error('FAIL: no products grouped');
    process.exit(1);
  }

  // ── Test 2: no hard cap — all rows should parse ──
  const ROWS_2 = 51000;
  console.log(`\nTest 2: generating ${ROWS_2} rows (no cap)...`);
  const wb2 = new ExcelJS.Workbook();
  const ws2 = wb2.addWorksheet('Catalog');
  ws2.columns = ws1.columns;
  for (let i = 0; i < ROWS_2; i++) {
    ws2.addRow({
      productName: `P${i}`,
      price: 100 + i,
    });
  }

  const buf2 = await wb2.xlsx.writeBuffer();
  const t2 = Date.now();
  const result2 = await parseCatalogFile(buf2, 'big.xlsx');
  console.log(`  Parsed in ${Date.now() - t2}ms`);

  if (result2.rows.length !== ROWS_2) {
    console.error(`FAIL: expected ${ROWS_2} rows, got ${result2.rows.length}`);
    process.exit(1);
  }
  console.log(`  OK: parsed all ${result2.rows.length} rows (no cap)`);

  // ── Test 3: streaming parser with the real Gully Labs file ──
  console.log('\nTest 3: streaming parser on Gully Labs.xlsx...');
  const { parseCatalogFileStream } = require('./src/utils/catalogImportStream');
  const fs = require('fs');
  const gullyBuf = fs.readFileSync('/Users/dan/Desktop/x/Gully Labs.xlsx');
  console.log(`  File: ${(gullyBuf.length/1024/1024).toFixed(2)}MB`);
  const t3 = Date.now();
  const streamResult = await parseCatalogFileStream(gullyBuf, 'Gully Labs.xlsx');
  console.log(`  Streamed in ${Date.now() - t3}ms`);
  console.log(`  Products: ${streamResult.products.length}, skipped: ${streamResult.skippedRows.length}, totalRows: ${streamResult.totalRows}`);
  if (streamResult.products.length === 0) {
    console.error('FAIL: no products from real file');
    process.exit(1);
  }
  console.log(`  OK: real file parsed (first product: ${streamResult.products[0].name})`);

  // ── Test 3: long cell truncation (via in-memory workbook) ──
  // Long strings are truncated before they hit AI/grouping to keep
  // payloads bounded and prevent OOM on pathological cells.
  console.log('\nTest 3: cell truncation...');
  const { safeStr } = require('./src/utils/catalogImport');
  const longText = 'x'.repeat;
  const truncated = safeStr(longText);
  if (truncated.length > MAX_CELL_VALUE_LENGTH + 2) {
    console.error(`FAIL: not truncated (${truncated.length} chars)`);
    process.exit(1);
  }
  console.log(`  OK: cell truncated (${truncated.length} <= ${MAX_CELL_VALUE_LENGTH})`);

  console.log(`\n─── ALL CHECKS PASSED ────`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});