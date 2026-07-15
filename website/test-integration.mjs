import http from 'http';
import { spawn } from 'child_process';

const API_BASE = 'http://localhost:8081';
let passed = 0, failed = 0;

function test(name, ok, detail) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`); }
}

function apiPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: 'localhost', port: 8081, path, method: 'POST', headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(API_BASE + path, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    }).on('error', reject);
  });
}

async function waitForServer(maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await apiGet('/health');
      if (res.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function run() {
  console.log('=== Starting Tests ===\n');

  // 1. Backend health
  console.log('--- Backend Health ---');
  const healthy = await waitForServer();
  test('Backend running on :8081', healthy);
  if (!healthy) { console.log('\nFAILED: Backend not available'); process.exit(1); }

  // 2. OpenAI key + Chat
  console.log('\n--- AI Chatbot ---');
  const chatRes = await apiPost('/api/ai/chat', {
    messages: [{ role: 'user', content: 'Tell me about the Geometric Crossbody Harness' }]
  });
  test('Chat endpoint returns 200', chatRes.status === 200, `Got ${chatRes.status}`);
  if (chatRes.status === 200) {
    const hasKey = !(chatRes.data.message || '').includes('AI service not configured');
    test('OpenAI API key is configured', hasKey);
    test('Response has products', (chatRes.data.products?.length || 0) > 0, `Found ${chatRes.data.products?.length}`);
    test('Response mentions product', (chatRes.data.message || '').includes('Geometric'), chatRes.data.message?.substring(0, 80));
  }

  // 3. Products with embeddings
  console.log('\n--- Product Embeddings ---');
  const prodRes = await apiGet('/api/products');
  if (prodRes.status === 200) {
    const products = Array.isArray(prodRes.data) ? prodRes.data : [];
    test('Products endpoint returns data', products.length > 0, `Got ${products.length} products`);
    if (products.length > 0) {
      const embedded = products.filter(p => p.embedding && p.embedding.length > 0);
      test('Products have embeddings', embedded.length > 0, `${embedded.length}/${products.length}`);
    }
  } else {
    test('Products endpoint', false, `Status ${prodRes.status}`);
  }

  // 4. Website signup page (Google button redirect)
  console.log('\n--- Website: Google Auth ---');
  const websiteUp = await new Promise(resolve => {
    http.get('http://localhost:3000/signup', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        resolve({ ok: true, body: d });
      });
    }).on('error', () => resolve({ ok: false, body: '' }));
  });
  test('Website running on :3000', websiteUp.ok);
  test('Signup page loads', websiteUp.body.includes('DRYP'), websiteUp.ok ? '' : 'Website not reachable');

  // 5. Website dashboard
  console.log('\n--- Website: Dashboard ---');
  try {
    const dashRes = await fetch('http://localhost:3000/dashboard');
    test('Dashboard loads', dashRes.ok, `Status ${dashRes.status}`);
  } catch {
    test('Dashboard loads', false, 'Not reachable');
  }

  // 6. Google redirect URI construction
  console.log('\n--- Google OAuth Redirect URI ---');
  const googHref = websiteUp.body.includes('/api/auth/google');
  test('Signup page links to /api/auth/google', googHref);

  console.log('\n======= SUMMARY =======');
  console.log(`Passed: ${passed} / ${passed + failed}`);
  if (failed === 0) console.log('All tests passed!');
  else console.log(`${failed} test(s) failed`);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
