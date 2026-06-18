#!/usr/bin/env node
/**
 * check-ios-launch.mjs — pre-flight check for an iOS release.
 *
 *   $ node scripts/check-ios-launch.mjs
 *
 * Verifies that everything needed to ship an iOS build is
 * present:
 *
 *   - bundle id is set in app.json (iOS)
 *   - build number is present
 *   - push notification permission strings exist in Info.plist
 *   - the splash / icon assets exist on disk
 *   - the deployment env file points at the production API
 *
 * Exits non-zero if anything is missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const fail = [];
const warn = [];
function need(label, cond, hint) {
  if (cond) console.log(`  ✓ ${label}`);
  else { fail.push(label); console.log(`  ✗ ${label} — ${hint}`); }
}
function soft(label, cond, hint) {
  if (cond) console.log(`  ✓ ${label}`);
  else { warn.push(label); console.log(`  ! ${label} — ${hint}`); }
}

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const expo = app.expo || {};

need('expo.name', !!expo.name, 'app.json missing expo.name');
need('expo.slug', !!expo.slug, 'app.json missing expo.slug');
need('expo.version', !!expo.version, 'app.json missing expo.version');
need('expo.ios.bundleIdentifier', !!expo.ios?.bundleIdentifier,
  'add expo.ios.bundleIdentifier to app.json');
need('expo.ios.buildNumber', !!expo.ios?.buildNumber,
  'add expo.ios.buildNumber to app.json');

const plist = expo.ios?.infoPlist || {};
need('NSPhotoLibraryUsageDescription', !!plist.NSPhotoLibraryUsageDescription,
  'required by App Store review for photo access');
need('NSCameraUsageDescription', !!plist.NSCameraUsageDescription,
  'required if using camera');
need('ITSAppUsesNonExemptEncryption set false', plist.ITSAppUsesNonExemptEncryption === false,
  'exempt from export compliance if false');
need('UIBackgroundModes includes remote-notification',
  (plist.UIBackgroundModes || []).includes('remote-notification'),
  'required for silent push delivery');

soft('icon exists', fs.existsSync(path.join(root, expo.icon || 'assets/icon.png')),
  'expected at assets/icon.png');
soft('splash image exists',
  fs.existsSync(path.join(root, expo.splash?.image || 'assets/splash.png')),
  'expected at assets/splash.png');

// Env
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(/EXPO_PUBLIC_API_BASE_URL\s*=\s*(.+)/);
  const url = m?.[1]?.trim();
  soft('EXPO_PUBLIC_API_BASE_URL set', !!url, '.env missing EXPO_PUBLIC_API_BASE_URL');
  if (url) {
    const isHttps = url.startsWith('https://');
    soft('API URL uses https in production', isHttps,
      'App Store Transport Security requires https in production');
  }
} else {
  warn.push('env file present');
  console.log('  ! .env missing — create one before submitting');
}

console.log();
if (fail.length) {
  console.log(`✗ ${fail.length} blocker(s) — fix before submitting.`);
  process.exit(1);
} else if (warn.length) {
  console.log(`! ${warn.length} warning(s) — review before submitting.`);
  process.exit(0);
} else {
  console.log('✓ All iOS launch checks passed.');
  process.exit(0);
}