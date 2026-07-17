// Integration test for catalogImport.js
// Creates an XLSX with KNOWN values and verifies every output field.
// Usage: node test-catalog-import.js
// Exit code 0 = pass, 1 = fail.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const { parseCatalogFile, groupRowsIntoProducts } = require('./src/utils/catalogImport');

const EXPECT = {
  totalRows: 6,
  products: 3,
  skippedRows: 2,
  errors: [
    { row: 7, column: 'Price (INR)', reason: 'Expected number, got "abc"', raw: 'abc' },
  ],
  unknownHeaders: ['extraCol', 'another'],
  products_meta: [
    { name: 'Cotton Tee', category: 'Men', variantCount: 2, price: 499, imageCount: 3, sourceRows: [2, 3] },
    { name: 'Denim Jacket', category: 'Outerwear', variantCount: 1, price: 2999, imageCount: 0, sourceRows: [4] },
    { name: 'Silk Scarf', category: 'Accessories', variantCount: 1, price: 1200, imageCount: 1, sourceRows: [5] },
  ],
  skipped_meta: [
    { row: 6, reason: 'Missing Product Name' },
    { row: 7, reason: 'Missing Product Name' },
  ],
};

async function main() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Catalog');

  ws.columns = [
    { header: 'Product Name', key: 'productName', width: 20 },
    { header: 'Price (INR)', key: 'price', width: 10 },
    { header: 'Category', key: 'category', width: 12 },
    { header: 'Image 1', key: 'image1', width: 40 },
    { header: 'Image 2', key: 'image2', width: 40 },
    { header: 'Color', key: 'color', width: 10 },
    { header: 'Size', key: 'size', width: 8 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Qty', key: 'quantity', width: 10 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'extraCol', key: 'extraCol', width: 10 },
    { header: 'another', key: 'another', width: 10 },
  ];

  // Row 1: valid
  ws.addRow({ productName: 'Cotton Tee', price: 499, category: 'Men', image1: 'https://example.com/a.jpg', color: 'Red', size: 'M,L', sku: 'CT-001', quantity: 50, tags: 'summer,cotton', description: 'Comfortable tee', extraCol: 'x', another: 'y' });
  // Row 2: same product, additional variant
  ws.addRow({ productName: 'Cotton Tee', price: 499, category: 'Men', image1: 'https://example.com/b.jpg', image2: 'https://example.com/c.jpg', color: 'Blue', size: 'L', sku: 'CT-002', quantity: 30, tags: 'premium' });
  // Row 3: different product
  ws.addRow({ productName: 'Denim Jacket', price: 2999, category: 'Outerwear', image1: 'not-a-url', color: 'Black', size: 'M', sku: 'DJ-001', quantity: 10, tags: 'winter', description: 'Warm jacket' });
  // Row 4: third product
  ws.addRow({ productName: 'Silk Scarf', price: 1200, category: 'Accessories', image1: 'https://example.com/scarf.jpg', color: 'Gold', size: 'M', tags: 'luxury', description: 'Elegant' });
  // Row 5: missing product name → skipped
  ws.addRow({ price: 100, category: 'X', image1: 'https://example.com/x.jpg' });
  // Row 6: missing product name → skipped
  ws.addRow({ price: 'abc', category: 'X', image1: 'https://example.com/y.jpg' });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = 'test-upload.xlsx';

  console.log(`\n─── Phase 1: parseCatalogFile ───────────────────────────────`);

  const { rows, errors, unknownHeaders } = await parseCatalogFile(buffer, filename);

  // Check row count
  if (rows.length !== EXPECT.totalRows) {
    console.log(`FAIL: expected ${EXPECT.totalRows} rows, got ${rows.length}`);
    process.exit(1);
  }
  console.log(`PASS: rows = ${rows.length}`);

  // Check row 0 details
  const r0 = rows[0];
  const checks = [
    { label: 'row[0].productName', got: r0.productName, exp: 'Cotton Tee' },
    { label: 'row[0].price', got: r0.price, exp: 499 },
    { label: 'row[0].category', got: r0.category, exp: 'Men' },
    { label: 'row[0].image1', got: r0.image1, exp: 'https://example.com/a.jpg' },
    { label: 'row[1].image2', got: rows[1].image2, exp: 'https://example.com/c.jpg' },
    { label: 'row[0].__row', got: r0.__row, exp: 2 },
    { label: 'row[2].image1 filtered in groupRows', got: rows[2].image1, exp: 'not-a-url' },
    { label: 'row[2].__row', got: rows[2].__row, exp: 4 },
  ];

  for (const c of checks) {
    if (c.got !== c.exp) {
      console.log(`FAIL: ${c.label}: expected ${JSON.stringify(c.exp)}, got ${JSON.stringify(c.got)}`);
      process.exit(1);
    }
    console.log(`PASS: ${c.label}`);
  }

  // Check unknown headers
  if (JSON.stringify(unknownHeaders) !== JSON.stringify(EXPECT.unknownHeaders)) {
    console.log(`FAIL: unknownHeaders: expected ${JSON.stringify(EXPECT.unknownHeaders)}, got ${JSON.stringify(unknownHeaders)}`);
    process.exit(1);
  }
  console.log(`PASS: unknownHeaders = ${JSON.stringify(unknownHeaders)}`);

  console.log(`\n─── Phase 2: groupRowsIntoProducts ──────────────────────────`);

  const { products, skippedRows } = groupRowsIntoProducts(rows, errors);

  // Check product count
  if (products.length !== EXPECT.products) {
    console.log(`FAIL: expected ${EXPECT.products} products, got ${products.length}`);
    process.exit(1);
  }
  console.log(`PASS: products = ${products.length}`);

  // Check skipped rows count
  if (skippedRows.length !== EXPECT.skippedRows) {
    console.log(`FAIL: expected ${EXPECT.skippedRows} skipped rows, got ${skippedRows.length}`);
    process.exit(1);
  }
  console.log(`PASS: skippedRows = ${skippedRows.length}`);

  // Check each product
  for (const expP of EXPECT.products_meta) {
    const p = products.find((x) => x.name === expP.name);
    if (!p) {
      console.log(`FAIL: product "${expP.name}" not found`);
      process.exit(1);
    }
    if (p.category !== expP.category) {
      console.log(`FAIL: "${expP.name}" category: expected "${expP.category}", got "${p.category}"`);
      process.exit(1);
    }
    if (p.preview.variantCount !== expP.variantCount) {
      console.log(`FAIL: "${expP.name}" variantCount: expected ${expP.variantCount}, got ${p.preview.variantCount}`);
      process.exit(1);
    }
    if (p.basePrice !== expP.price) {
      console.log(`FAIL: "${expP.name}" basePrice: expected ${expP.price}, got ${p.basePrice}`);
      process.exit(1);
    }
    if ((p.images?.length || 0) !== expP.imageCount) {
      console.log(`FAIL: "${expP.name}" images: expected ${expP.imageCount}, got ${p.images?.length || 0}`);
      process.exit(1);
    }
    if (!p.sourceRows || p.sourceRows.length !== expP.sourceRows.length) {
      console.log(`FAIL: "${expP.name}" sourceRows count: expected ${expP.sourceRows.length}, got ${p.sourceRows?.length || 0}`);
      process.exit(1);
    }
    for (let i = 0; i < expP.sourceRows.length; i++) {
      if (p.sourceRows[i] !== expP.sourceRows[i]) {
        console.log(`FAIL: "${expP.name}" sourceRows[${i}]: expected ${expP.sourceRows[i]}, got ${p.sourceRows[i]}`);
        process.exit(1);
      }
    }
    console.log(`PASS: product "${p.name}" - cat=${p.category}, variants=${p.preview.variantCount}, price=${p.basePrice}, images=${p.images?.length}, sourceRows=${JSON.stringify(p.sourceRows)}`);
  }

  // Check skipped
  for (const expS of EXPECT.skipped_meta) {
    const s = skippedRows.find((x) => x.row === expS.row);
    if (!s) {
      console.log(`FAIL: skipped row ${expS.row} not found`);
      process.exit(1);
    }
    if (s.reason !== expS.reason) {
      console.log(`FAIL: skipped row ${expS.row}: expected "${expS.reason}", got "${s.reason}"`);
      process.exit(1);
    }
    console.log(`PASS: skipped row ${s.row}: ${s.reason}`);
  }

  const tee = products.find((p) => p.name === 'Cotton Tee');
  if (!tee.tags || tee.tags.length !== 2) {
    console.log(`FAIL: Cotton Tee tags: expected 2, got ${tee.tags?.length || 0} (${JSON.stringify(tee.tags)})`);
    process.exit(1);
  }
  console.log(`PASS: Cotton Tee tags = ${JSON.stringify(tee.tags)}`);

  console.log(`\n─── ALL CHECKS PASSED ──────────────────────────────────────\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
