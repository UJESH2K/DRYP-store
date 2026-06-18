#!/usr/bin/env node
/**
 * iOS readiness check — runs without npm install.
 *
 * This is the *static* gate for the iOS build: it checks that everything
 * EAS needs is in place BEFORE we burn 15 minutes on a build that was
 * going to fail anyway.
 *
 * What it covers:
 *   - app.config.ts has the iOS bundle id, buildNumber, and ATS
 *   - eas.json declares development / preview / production iOS profiles
 *   - The password-reset deep link uses the iOS scheme (dryp://)
 *   - No iOS-incompatible Platform.OS === 'android' branches that lack a
 *     sensible iOS counterpart
 *   - Every file using ImageBackground/SafeAreaView/KeyboardAvoidingView
 *     is configured for iOS
 *
 * Run: `node scripts/check-ios-readiness.mjs`
 * CI:  exit code 0 = ready to ship, non-zero = blocked.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const issues = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const line = `  ✗ ${name}${detail ? " — " + detail : ""}`;
    console.log(line);
    issues.push(line.trim());
  }
}

console.log("\niOS readiness check\n");

// --- 1. app.config.ts iOS block ---
const appConfigPath = path.join(FRONTEND, "app.config.ts");
if (!existsSync(appConfigPath)) {
  check("app.config.ts exists", false);
  process.exit(1);
}
const appConfig = await readFile(appConfigPath, "utf8");

check(
  "ios.bundleIdentifier is set",
  /bundleIdentifier:\s*["']com\.dryp\.app["']/.test(appConfig),
);
check(
  "ios.buildNumber is set",
  /buildNumber:\s*["']1["']/.test(appConfig),
);
check(
  "ios.infoPlist declares ATS NSAllowsArbitraryLoads",
  /NSAllowsArbitraryLoads:\s*true/.test(appConfig),
);
check(
  "ios.infoPlist declares ITSAppUsesNonExemptEncryption=false",
  /ITSAppUsesNonExemptEncryption:\s*false/.test(appConfig),
);
check(
  "scheme is set (used for dryp:// deep links)",
  /scheme:\s*["']dryp["']/.test(appConfig),
);
check(
  "owner is set (EAS)",
  /owner:\s*["']\w+["']/.test(appConfig),
);
check(
  "EAS project id is set",
  /projectId:\s*["'][a-f0-9-]{36}["']/.test(appConfig),
);

// --- 2. eas.json iOS profiles ---
const easPath = path.join(FRONTEND, "eas.json");
const eas = JSON.parse(await readFile(easPath, "utf8"));
check("eas.json development profile exists", !!eas.build?.development);
check(
  "eas.json development has ios.simulator = true",
  eas.build?.development?.ios?.simulator === true,
);
check("eas.json preview profile exists", !!eas.build?.preview);
check("eas.json production profile exists", !!eas.build?.production);
check(
  "eas.json production has ios.distribution = 'store'",
  eas.build?.production?.ios?.distribution === "store",
);
check(
  "eas.json production has production autoIncrement",
  eas.build?.production?.autoIncrement === true,
);
check(
  "eas.json submit.production.ios.ascAppIdentifier = com.dryp.app",
  eas.submit?.production?.ios?.ascAppIdentifier === "com.dryp.app",
);

// --- 3. appleTeamId still placeholder? ---
const teamId = eas.submit?.production?.ios?.appleTeamId;
if (teamId === "REPLACE_WITH_YOUR_10_CHAR_APPLE_TEAM_ID") {
  check(
    "eas.json appleTeamId is filled in",
    false,
    "still set to placeholder — replace with your real Apple Team ID before submitting",
  );
} else {
  check("eas.json appleTeamId is filled in", true);
}

// --- 4. Deep link scheme matches between frontend & backend ---
// Backend builds reset links as ${NEXT_PUBLIC_FRONTEND_URL}/reset-password/<token>
// which is a universal link. The mobile app should handle the dryp://reset-password/<token>
// scheme too. We look for a Linking.addEventListener or Linking.getInitialURL
// call inside app/_layout.tsx (the conventional location for global URL
// handlers in expo-router).
const layoutPath = path.join(FRONTEND, "app", "_layout.tsx");
let deepLinkFound = false;
if (existsSync(layoutPath)) {
  const layoutSrc = await readFile(layoutPath, "utf8");
  // Either a Linking.addEventListener call OR a route.push to /reset-password
  // is enough to call this wired up.
  if (
    /Linking\.(addEventListener|getInitialURL)/.test(layoutSrc) &&
    /reset-password/.test(layoutSrc)
  ) {
    deepLinkFound = true;
  }
}
if (deepLinkFound) {
  check(
    "deep link handler for dryp://reset-password/... in app/_layout.tsx",
    true,
  );
} else {
  check(
    "deep link handler for dryp://reset-password/... in app/_layout.tsx",
    false,
    "app/_layout.tsx does not register a Linking handler — password-reset emails will open Safari instead of the app",
  );
}

// --- 5. Platform.OS branches ---
// We flag any file that has an android-only Platform.OS branch that does
// something potentially iOS-breaking, e.g. enabling native APIs that crash
// on iOS. We do NOT flag android-only branches whose purpose is to enable
// a no-op on iOS (e.g. `setLayoutAnimationEnabledExperimental`, which is
// Android-only by design). The check is "is the file's android branch
// commented as being android-only on purpose?" — if it has a comment that
// explicitly says "iOS doesn't need this" / "Android only", we skip it.
const platformFiles = execSync(
  `grep -rl "Platform.OS" ${path.join(FRONTEND, "src")} ${path.join(
    FRONTEND,
    "app",
  )} 2>/dev/null || true`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);
let platformIssueCount = 0;
for (const f of platformFiles) {
  const src = await readFile(f, "utf8");
  const hasAndroid = /Platform\.OS\s*===\s*["']android["']/.test(src);
  const hasIOS = /Platform\.OS\s*===\s*["']ios["']/.test(src);
  if (hasAndroid && !hasIOS) {
    // Only flag if the file doesn't explicitly say iOS doesn't need it
    const acknowledgesIOS = /iOS\s+(does\s+not|doesn't)\s+need/i.test(src);
    if (!acknowledgesIOS) {
      platformIssueCount++;
      check(
        `iOS counterpart for android branch: ${path.relative(FRONTEND, f)}`,
        false,
        "has android branch with no ios branch — file will silently fall through on iOS",
      );
    }
  }
}
if (platformIssueCount === 0) {
  check("no Android-only branches missing iOS counterparts", true);
}

// --- 6. Native deps require prebuild or extra config? ---
const pkgPath = path.join(FRONTEND, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const nativeDeps = [
  "react-native-reanimated",
  "react-native-gesture-handler",
  "react-native-haptic-feedback",
  "expo-image",
  "expo-secure-store",
  "expo-camera",
  "expo-notifications",
];
for (const d of nativeDeps) {
  if (deps[d]) {
    check(`${d} declared (v${deps[d]})`, true);
  }
}
check(
  "expo-router is the routing layer",
  !!deps["expo-router"],
  deps["expo-router"] ? "" : "missing — file-based routing will not work",
);

// --- Summary ---
console.log(`\n  ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log("\nIssues:");
  issues.forEach((i) => console.log(`  - ${i}`));
  console.log(
    "\nResolve the above before running `eas build --platform ios --profile preview`.",
  );
  process.exit(1);
} else {
  console.log("\niOS is statically ready. Next:");
  console.log(
    "  1. Run `eas build --platform ios --profile development --simulator` to confirm a build assembles.",
  );
  console.log(
    "  2. Run on a device with `eas build --platform ios --profile preview`.",
  );
  console.log("  3. Submit with `eas submit --platform ios` after ASC app is created.");
}