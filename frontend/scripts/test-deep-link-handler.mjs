#!/usr/bin/env node
/**
 * Test the deep-link parsing logic used by app/_layout.tsx.
 *
 * The actual handler lives in app/_layout.tsx and pulls in expo-router,
 * react-native, etc. — too heavy to import from a node script. So we
 * mirror the parsing logic here and verify it against expected behaviour.
 *
 * If you change the handler in _layout.tsx, change it here too. The
 * test is intentionally a duplicate-and-verify rather than a shared
 * helper, because hoisting it would require shipping a non-React-Native
 * module from the app code.
 */

import { strict as assert } from "node:assert";

/**
 * Parse a `dryp://...` URL into an in-app route.
 *
 * @param {string} url
 * @returns {{ route: string } | null}
 */
function parseDeepLink(url) {
  if (!url || !url.startsWith("dryp://")) return null;
  // Strip scheme.
  const rest = url.slice("dryp://".length);
  const [pathPart, queryPart] = rest.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart || "");

  if (segments[0] === "reset-password" && segments[1]) {
    return {
      route: `/reset-password/${encodeURIComponent(segments[1])}`,
    };
  }
  if (segments[0] === "reset-password" && query.get("token")) {
    return {
      route: `/reset-password/${encodeURIComponent(query.get("token"))}`,
    };
  }
  if (segments[0] === "vendor-register") {
    const token = segments[1] || query.get("token");
    if (token) {
      return {
        route: `/vendor-register?token=${encodeURIComponent(token)}`,
      };
    }
  }
  return null;
}

const cases = [
  {
    name: "reset-password path with token",
    url: "dryp://reset-password/abc123def456",
    expected: "/reset-password/abc123def456",
  },
  {
    name: "reset-password query with token",
    url: "dryp://reset-password?token=abc123def456",
    expected: "/reset-password/abc123def456",
  },
  {
    name: "reset-password trailing slash",
    url: "dryp://reset-password/",
    expected: null,
  },
  {
    name: "vendor-register path with token",
    url: "dryp://vendor-register/xyz789",
    expected: "/vendor-register?token=xyz789",
  },
  {
    name: "vendor-register query with token",
    url: "dryp://vendor-register?token=xyz789",
    expected: "/vendor-register?token=xyz789",
  },
  {
    name: "unknown path",
    url: "dryp://foo/bar",
    expected: null,
  },
  {
    name: "wrong scheme",
    url: "https://dryp.com/reset-password/abc",
    expected: null,
  },
  {
    name: "empty url",
    url: "",
    expected: null,
  },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  const result = parseDeepLink(c.url);
  const got = result?.route ?? null;
  try {
    assert.equal(got, c.expected);
    console.log(`  ✓ ${c.name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${c.name}`);
    console.log(`      url:      ${c.url}`);
    console.log(`      expected: ${c.expected}`);
    console.log(`      got:      ${got}`);
    failed++;
  }
}

console.log(`\n  ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);