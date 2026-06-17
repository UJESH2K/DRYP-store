/**
 * Phase 3A — Excel import tests.
 *
 * Drives the parser against in-memory workbooks (no Express, no Mongo
 * when in dryRun mode). Verifies:
 *  - canonical headers work
 *  - aliases (e.g. "Title" for "name") work
 *  - bad rows are reported with a row number
 *  - dryRun returns ok=true without DB writes
 *  - tags string → array split
 *  - image URLs string → array split
 *  - basePrice string → number coercion
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env.MONGO_URI = 'mongodb://placeholder';

const XLSX = require('xlsx');
const { parseAndValidate, normalizeHeader, coerceRow } = require('../src/utils/excelImport');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function makeBuffer(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

(async () => {
  // header normalization
  check('header: Name → name', normalizeHeader('Name') === 'name');
  check('header: TITLE → name', normalizeHeader('TITLE') === 'name');
  check('header: brand name → brand', normalizeHeader('brand name') === 'brand');
  check('header: total → null', normalizeHeader('total') === null);

  // coerceRow
  const coerced = coerceRow({
    'Name': 'Tee', 'Brand': 'Zara', 'Category': 'tops',
    'Price': '19.99', 'Stock': '5',
    'Tags': 'casual, summer, cotton', 'Images': 'https://x.com/a.jpg,https://x.com/b.jpg',
  });
  check('coerce: basePrice is number', coerced.basePrice === 19.99);
  check('coerce: stock is int', coerced.stock === 5);
  check('coerce: tags is array of 3', Array.isArray(coerced.tags) && coerced.tags.length === 3);
  check('coerce: images is array of 2', Array.isArray(coerced.images) && coerced.images.length === 2);

  // dry run on a good sheet
  const good = makeBuffer([
    { name: 'Tee 1', brand: 'Zara', category: 'tops', basePrice: 19.99, stock: 5 },
    { name: 'Tee 2', brand: 'Zara', category: 'tops', basePrice: 24.99, stock: 3 },
  ]);
  const r1 = await parseAndValidate(good, 'v1', { dryRun: true });
  check('good: 2 rows', r1.rows.length === 2);
  check('good: both ok', r1.rows.every((r) => r.ok));
  check('good: both dryRun', r1.rows.every((r) => r.dryRun === true));
  check('good: 0 errors', r1.errors.length === 0);

  // mixed sheet: some good, some bad
  const mixed = makeBuffer([
    { name: 'OK 1', brand: 'Zara', category: 'tops', basePrice: 19.99, stock: 5 },
    { name: '', brand: 'Zara', category: 'tops', basePrice: 19.99, stock: 5 }, // missing name
    { name: 'OK 2', brand: '', category: 'tops', basePrice: 19.99, stock: 5 }, // missing brand
    { name: 'Bad price', brand: 'Zara', category: 'tops', basePrice: -1, stock: 5 }, // negative price
  ]);
  const r2 = await parseAndValidate(mixed, 'v1', { dryRun: true });
  check('mixed: 4 rows', r2.rows.length === 4);
  check('mixed: 1 ok, 3 fail', r2.rows.filter((r) => r.ok).length === 1 && r2.errors.length === 3);
  check('mixed: row 3 (empty name) is fail', !r2.rows[1].ok && r2.rows[1].row === 3);
  check('mixed: row 5 (bad price) is fail', !r2.rows[3].ok && r2.rows[3].row === 5);

  // header alias
  const aliased = makeBuffer([
    { Title: 'Tee', 'Brand Name': 'Zara', Type: 'tops', Cost: 10, Inventory: 7 },
  ]);
  const r3 = await parseAndValidate(aliased, 'v1', { dryRun: true });
  check('aliases: title/type/inventory recognized', r3.rows.length === 1 && r3.rows[0].ok);

  // empty sheet
  const empty = makeBuffer([]);
  const r4 = await parseAndValidate(empty, 'v1', { dryRun: true });
  check('empty: 0 rows', r4.rows.length === 0);

  // maxRows cap
  const many = makeBuffer(
    Array.from({ length: 50 }, (_, i) => ({
      name: 'P' + i, brand: 'X', category: 'top', basePrice: 1, stock: 1,
    }))
  );
  const r5 = await parseAndValidate(many, 'v1', { dryRun: true, maxRows: 10 });
  check('maxRows: caps at 10', r5.rows.length === 10);

  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();