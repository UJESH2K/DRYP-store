import { spawn } from 'child_process';
import http from 'http';

async function waitForURL(url, maxRetries = 40) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return { status: res.status, body: await res.text() };
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function main() {
  console.log('Starting website dev server...');
  const cp = spawn('node', ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  let output = '';
  cp.stdout.on('data', d => { output += d.toString(); });
  cp.stderr.on('data', d => { output += d.toString(); });

  console.log('Waiting for website...');
  const result = await waitForURL('http://localhost:3000/signup');

  if (!result) {
    console.log('Website failed to start');
    cp.kill();
    process.exit(1);
  }

  console.log('Website status:', result.status);

  // Check for Google OAuth button
  const hasGoogleBtn = result.body.includes('Continue with Google') || result.body.includes('google');
  console.log('Has Google button:', hasGoogleBtn);

  // Extract Google OAuth redirect URL
  const hrefMatch = result.body.match(/href="(https:\/\/accounts\.google\.com[^"]+)"/i);
  if (hrefMatch) {
    const redirectUriParam = decodeURIComponent(hrefMatch[1]);
    const hasCorrectPort = redirectUriParam.includes('redirect_uri=http%3A%2F%2Flocalhost%3A8081') || redirectUriParam.includes('redirect_uri=http://localhost:8081');
    console.log('Google OAuth URL found:', hasCorrectPort ? 'CORRECT (8081)' : 'WRONG PORT');
    if (!hasCorrectPort) {
      const match = redirectUriParam.match(/redirect_uri=([^&]+)/);
      if (match) console.log('  Actual redirect_uri:', decodeURIComponent(match[1]));
    }
  } else {
    console.log('No Google OAuth link found on signup page');
  }

  // Check dashboard page
  const dashResult = await fetch('http://localhost:3000/dashboard');
  if (dashResult.ok) {
    const dashHtml = await dashResult.text();
    console.log('Dashboard has Manual option:', dashHtml.includes('Manual'));
    console.log('Dashboard has Excel option:', dashHtml.includes('Excel'));
    console.log('Dashboard has Shopify option:', dashHtml.includes('Shopify') || dashHtml.includes('shopify-scrape'));
  }

  cp.kill();
  console.log('\nTests completed');
}

main();
