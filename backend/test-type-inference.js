// Regression test: type inference must not misidentify columns when
// early rows have empty values in non-numeric fields.
// Simulates the exact bug report: Product Name and Size typed as "number"
// because the first data rows had empty cells in those columns.

const ExcelJS = require('exceljs');
const { parseCatalogFile, groupRowsIntoProducts } = require('./src/utils/catalogImport');

async function main() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Catalog');

  ws.columns = [
    { header: 'Product Name', key: 'productName', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Colour', key: 'color', width: 8 },
    { header: 'Size', key: 'size', width: 8 },
    { header: 'Price (INR)', key: 'price', width: 12 },
    { header: 'Compare-at (INR)', key: 'compareAt', width: 12 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'In Stock?', key: 'inStock', width: 8 },
    { header: 'Quantity', key: 'quantity', width: 8 },
    { header: 'Image 1', key: 'image1', width: 40 },
    { header: 'Image 2', key: 'image2', width: 40 },
    { header: 'Product URL', key: 'productUrl', width: 40 },
  ];

  // Row 1: empty product name (tricks old inference into thinking col 1 is "number")
  ws.addRow({ price: '', compareAt: '', sku: '', inStock: '', quantity: '', image1: '', image2: '', productUrl: '' });
  // Row 2: empty product name + empty size
  ws.addRow({ type: 'UK 3', color: '', price: 5490, compareAt: 5490, sku: 'GL1_BAA_ECO_W_36', inStock: 'Yes', quantity: 15, size: '', image1: 'https://cdn.shopify.com/s/files/1/0693/2385/0012/files/Artboard8.png', image2: 'https://cdn.shopify.com/s/files/1/0693/2385/0012/files/Artboard4.png', productUrl: 'https://bluorng.com/products/gully-number-001' });
  // Row 3-6: Gully 17 Trousers variants — size is text (XS, S, M, L, XL)
  const baseTrouser = { productName: 'Gully 17 Trousers - Aaroh Brown', type: 'UK 3', color: 'Brown', price: 4990, compareAt: 4990, sku: 'GL17_TA_BR', inStock: 'Yes', quantity: 10, productUrl: 'https://bluorng.com/products/gully-17-trousers-aaroh-brown' };
  for (const size of ['XS', 'S', 'M', 'L', 'XL']) {
    ws.addRow({ ...baseTrouser, size });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const { rows, errors } = await parseCatalogFile(buffer, 'gully.xlsx');

  // No type errors should be present for text fields
  const textFieldErrors = errors.filter((e) =>
    e.column === 'Product Name' || e.column === 'Size'
  );

  if (textFieldErrors.length > 0) {
    console.log(`FAIL: Got ${textFieldErrors.length} type errors on text fields:`);
    textFieldErrors.forEach((e) => console.log(`  Row ${e.row}, col "${e.column}": ${e.reason}`));
    process.exit(1);
  }

  const grouped = groupRowsIntoProducts(rows);

  // Should produce at least one product (Gully 17 Trousers)
  const trousers = grouped.products.find((p) => p.name === 'Gully 17 Trousers - Aaroh Brown');
  if (!trousers) {
    console.log('FAIL: Gully 17 Trousers product not found');
    console.log('Products:', grouped.products.map((p) => p.name));
    process.exit(1);
  }

  if (trousers.preview.variantCount !== 5) {
    console.log(`FAIL: Expected 5 variants, got ${trousers.preview.variantCount}`);
    process.exit(1);
  }

  console.log('PASS: No spurious type errors on text columns');
  console.log(`PASS: Gully 17 Trousers parsed with ${trousers.preview.variantCount} variants`);
  console.log(`PASS: Total products = ${grouped.products.length}`);
  console.log('\n─── ALL CHECKS PASSED ──────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
