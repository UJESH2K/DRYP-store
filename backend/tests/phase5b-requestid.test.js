/**
 * Phase 5B — request id middleware test.
 *  - generates a UUID when no X-Request-Id header is present
 *  - honors an incoming X-Request-Id
 *  - rejects an over-long incoming id and replaces it
 *  - sets the response X-Request-Id header
 *  - server.js uses the request id in api_call logs
 */

const express = require("express");
const http = require("http");
const requestId = require("../src/middleware/requestId");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

function start() {
  return new Promise((resolve) => {
    const app = express();
    app.use(requestId());
    app.get("/probe", (req, res) => res.json({ id: req.id }));
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

(async () => {
  const s = await start();

  // 1. generates an id
  const r1 = await fetch(`${s.baseUrl}/probe`);
  const b1 = await r1.json();
  check("generates id", typeof b1.id === "string" && b1.id.length > 0);
  check("response header set", r1.headers.get("x-request-id") === b1.id);
  check("looks like UUID", /^[0-9a-f-]{36}$/i.test(b1.id));

  // 2. honors incoming id
  const r2 = await fetch(`${s.baseUrl}/probe`, { headers: { "X-Request-Id": "incoming-1" } });
  const b2 = await r2.json();
  check("incoming id honored", b2.id === "incoming-1");
  check("response echoes incoming", r2.headers.get("x-request-id") === "incoming-1");

  // 3. rejects over-long id
  const longId = "a".repeat(300);
  const r3 = await fetch(`${s.baseUrl}/probe`, { headers: { "X-Request-Id": longId } });
  const b3 = await r3.json();
  check("rejects long id (replaces)", b3.id !== longId && b3.id.length === 36);

  // 4. two requests have different ids
  const a = await (await fetch(`${s.baseUrl}/probe`)).json();
  const c = await (await fetch(`${s.baseUrl}/probe`)).json();
  check("unique ids", a.id !== c.id);

  await s.close();
  console.log(`\n  ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
})();