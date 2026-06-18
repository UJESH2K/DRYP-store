/**
 * Phase 0B unit test — schema validation offline.
 *
 * Exercises every zod schema in src/schemas/* without spinning up the
 * server. This is the catch-net for the live-server test (which is
 * rate-limited and can only sample a few cases per run).
 *
 * Run with: node tests/phase0b-schemas.test.js
 */
const common = require('../src/schemas/common');
const auth = require('../src/schemas/auth');

let passed = 0;
let failed = 0;

function expectValid(name, schema, value) {
  const r = schema.safeParse(value);
  if (!r.success) {
    console.error(`✗ ${name} — expected valid, got:`, r.error.issues);
    failed++;
    return;
  }
  passed++;
}

function expectInvalid(name, schema, value, contains) {
  const r = schema.safeParse(value);
  if (r.success) {
    console.error(`✗ ${name} — expected invalid, got:`, r.data);
    failed++;
    return;
  }
  if (contains && !r.error.issues.some(i => i.message.toLowerCase().includes(contains.toLowerCase()))) {
    console.error(`✗ ${name} — expected error containing "${contains}", got:`, r.error.issues);
    failed++;
    return;
  }
  passed++;
}

// ---- common.js ------------------------------------------------------------

// objectId
expectInvalid('objectId: too short', common.objectId, 'abc', '24-character hex');
expectInvalid('objectId: not hex', common.objectId, 'g'.repeat(24), '24-character hex');
expectValid('objectId: valid', common.objectId, '6a320be2cf9526134d6fbf63');

// email
expectInvalid('email: missing @', common.email, 'invalid', 'invalid email');
expectInvalid('email: empty', common.email, '', 'email is too short');
expectValid('email: lowercased', common.email, 'TEST@Example.com');
// verify the lowercasing happened
{
  const r = common.email.safeParse('TEST@Example.COM');
  if (r.success && r.data !== 'test@example.com') {
    console.error('✗ email: not lowercased', r.data);
    failed++;
  } else if (r.success) {
    passed++;
  } else {
    console.error('✗ email: parse failed', r.error);
    failed++;
  }
}

// password
expectInvalid('password: short', common.password, 'P1a', 'at least 8');
expectInvalid('password: no upper', common.password, 'password123', 'uppercase');
expectInvalid('password: no lower', common.password, 'PASSWORD123', 'lowercase');
expectInvalid('password: no digit', common.password, 'PasswordPass', 'digit');
expectInvalid('password: too long', common.password, 'a'.repeat(129), 'at most 128');
expectValid('password: good', common.password, 'GoodPass123');

// name
expectInvalid('name: empty', common.name, '   ', 'name is required');
expectValid('name: with spaces', common.name, '  Alice  ');
// verify the trim
{
  const r = common.name.safeParse('  Alice  ');
  if (r.success && r.data !== 'Alice') {
    console.error('✗ name: not trimmed', JSON.stringify(r.data));
    failed++;
  } else if (r.success) {
    passed++;
  }
}

// guestId
expectInvalid('guestId: empty', common.guestId, '', 'at least 1');
expectValid('guestId: present', common.guestId, 'abc-123');

// role
expectInvalid('role: not enum', common.role, 'superuser', 'Invalid enum value');
expectValid('role: user', common.role, 'user');
expectValid('role: vendor', common.role, 'vendor');
expectValid('role: admin', common.role, 'admin');

// pagination
{
  const r = common.pagination.safeParse({ limit: '50' });
  if (!r.success) {
    console.error('✗ pagination: coerce limit', r.error.issues);
    failed++;
  } else if (r.data.limit !== 50) {
    console.error('✗ pagination: coerce limit value', r.data);
    failed++;
  } else {
    passed++;
  }
}
{
  const r = common.pagination.safeParse({});
  if (!r.success || r.data.page !== 1 || r.data.limit !== 20) {
    console.error('✗ pagination: defaults', r);
    failed++;
  } else {
    passed++;
  }
}
expectInvalid('pagination: limit too high', common.pagination, { limit: 200 }, 'less than or equal to 100');

// ---- auth.js --------------------------------------------------------------

// register
expectInvalid('auth.register: missing email', auth.register, { name: 'A', password: 'GoodPass123' });
expectInvalid('auth.register: weak password', auth.register, { name: 'A', email: 'a@b.com', password: 'weak' });
expectInvalid('auth.register: extra field', auth.register, { name: 'A', email: 'a@b.com', password: 'GoodPass123', evil: true }, 'unrecogn');
expectValid('auth.register: valid', auth.register, { name: 'A', email: 'a@b.com', password: 'GoodPass123', guestId: 'g1' });

// login
expectInvalid('auth.login: missing password', auth.login, { email: 'a@b.com' });
expectValid('auth.login: short password OK on login', auth.login, { email: 'a@b.com', password: 'x' });
// (This is the intentional looseness — see comment in auth.js schema.)
expectValid('auth.login: empty guestId', auth.login, { email: 'a@b.com', password: 'whatever' });

// forgotPassword
expectInvalid('auth.forgotPassword: missing email', auth.forgotPassword, {});

// resetPassword
expectInvalid('auth.resetPassword: weak', auth.resetPassword, { password: 'weak' });
expectValid('auth.resetPassword: good', auth.resetPassword, { password: 'GoodPass123' });

// resetTokenParam
expectInvalid('auth.resetTokenParam: too short', auth.resetTokenParam, { token: 'abc' });
expectInvalid('auth.resetTokenParam: not hex', auth.resetTokenParam, { token: 'g'.repeat(40) });
expectValid('auth.resetTokenParam: 40 hex', auth.resetTokenParam, { token: 'a'.repeat(40) });

// ---- summary --------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('🎉 Phase 0B schema unit tests passed.');
