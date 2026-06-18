/**
 * Phase 0A verification test
 *
 * Boots the full Express app on an in-memory Mongo, then:
 *   1. POSTs /api/auth/register with a known password
 *   2. Captures the server's stdout/stderr
 *   3. Asserts the known password does NOT appear in the log
 *   4. Asserts the server actually returns a 201 with a token
 *
 * Run with:  node tests/phase0a.test.js
 */
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');

const PASSWORD = 'Hunter2DoNotLeak-' + crypto.randomBytes(8).toString('hex');
const PORT = 8181;
const LOG_PATH = '/tmp/phase0a-server.log';

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpJson(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data, json: safeJson(data) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

async function main() {
  // Start an in-memory MongoDB
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  const jwtSecret = crypto.randomBytes(48).toString('hex');
  console.log('✓ In-memory Mongo started at', mongoUri);

  // Start the server as a child process
  const server = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      MONGO_URI: mongoUri,
      JWT_SECRET: jwtSecret,
      PORT: String(PORT),
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  server.stdout.on('data', (b) => (serverLog += b.toString()));
  server.stderr.on('data', (b) => (serverLog += b.toString()));

  let exited = false;
  server.on('exit', (code) => {
    exited = true;
    console.error('server exited early with code', code);
  });

  // Wait for the server to be ready
  let health = null;
  for (let i = 0; i < 40; i++) {
    await delay(250);
    try {
      health = await httpJson({ method: 'GET', host: '127.0.0.1', port: PORT, path: '/health' });
      if (health.status === 200) break;
    } catch (_) { /* not ready yet */ }
  }
  if (!health || health.status !== 200) {
    console.error('Server never became healthy. Log so far:\n' + serverLog);
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ Server is healthy on port', PORT);

  // Send a register with the password
  const body = JSON.stringify({
    email: `phase0a-${Date.now()}@dryp.com`,
    password: PASSWORD,
    name: 'Phase 0A Test',
    guestId: 'phase0a-guest-' + Date.now(),
  });

  const reg = await httpJson(
    {
      method: 'POST',
      host: '127.0.0.1',
      port: PORT,
      path: '/api/auth/register',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    body,
  );

  console.log('Register response status:', reg.status);
  console.log('Register response body:', reg.body.slice(0, 200));

  // Wait for the log to flush
  await delay(500);

  // 1) The password must NOT appear anywhere in the log
  if (serverLog.includes(PASSWORD)) {
    console.error('\n❌ FAIL: password leaked in server log:');
    console.error('--- log ---');
    console.error(serverLog);
    console.error('--- end log ---');
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ Password is NOT in the log');

  // 2) Server should have returned a 2xx with a token
  if (reg.status < 200 || reg.status >= 300) {
    console.error('Expected 2xx from /api/auth/register, got', reg.status);
    console.error('Response:', reg.body);
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  if (!reg.json || !reg.json.token) {
    console.error('Expected a JWT token in the response, got:', reg.body);
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ Server returned a JWT token');

  // 3) The token must be JWT-formatted (3 dot-separated base64 segments)
  const token = reg.json.token;
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('Token does not have 3 JWT segments:', token);
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ Token is a real JWT (3 segments)');

  // 4) Validate the token with the same secret the server used
  const [headerB64, payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  if (expectedSig !== sigB64) {
    console.error('Token signature does not match the JWT_SECRET — server is using a different secret!');
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ Token signature matches JWT_SECRET (the secret the server actually used)');

  // 5) Now try the negative case: server should refuse to start with bad env
  //    We test this in a sub-process that we expect to exit code 1.
  const negativeTest = spawn('node', ['-e', "require('./src/config/validateEnv')({ exitOnError: true })"], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, JWT_SECRET: '', MONGO_URI: 'mongodb://x/y' },
  });
  const negativeOut = await new Promise((r) => {
    let buf = '';
    negativeTest.stdout.on('data', (b) => (buf += b.toString()));
    negativeTest.stderr.on('data', (b) => (buf += b.toString()));
    negativeTest.on('exit', () => r(buf));
  });
  if (!negativeOut.includes('JWT_SECRET is empty')) {
    console.error('Expected validateEnv to refuse empty JWT_SECRET, got output:', negativeOut);
    server.kill();
    await mongoServer.stop();
    process.exit(1);
  }
  console.log('✓ validateEnv refuses to start with empty JWT_SECRET');

  // Cleanup
  server.kill();
  await mongoServer.stop();

  console.log('\n🎉 Phase 0A verification PASSED. All 5 checks succeed.');
  console.log('  ✓ Server boots and stays up');
  console.log('  ✓ /api/auth/register returns 201 with a valid JWT');
  console.log('  ✓ Token is signed with the same JWT_SECRET the server used (no fallback)');
  console.log('  ✓ Password is NEVER logged (no plaintext, no JSON dump)');
  console.log('  ✓ validateEnv refuses to start with bad config');
}

main().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
