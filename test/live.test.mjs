// Live suite. Opt-in: `npm run test:live`.
//
// These assertions talk to the real chain and the real MCP server, so they are
// deliberately structural rather than value-pinned where the value can move
// (block heights, gas prices) and only pin values where the docs themselves make
// a claim the chain can contradict (chain IDs, the MCP tool list).
//
// A skipped run prints why. It never reports success it did not observe.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { collectLiveSnapshot } from "../src/live.mjs";
import { buildAudit } from "../src/audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failures.push({ name, err });
    process.stdout.write(`  FAIL ${name}\n         ${err.message.split("\n")[0]}\n`);
  }
}

const corpus = JSON.parse(await readFile(path.join(ROOT, "data", "corpus.json"), "utf8"));
const documentedTools = [...new Set(
  (corpus.pages.find((p) => p.id === "tooling-and-infrastructure/mcp")?.plain.match(/\b(?:get|send|eth|estimate)_[a-z0-9_]+\b/g) || []),
)].sort();

process.stdout.write(`\ncollecting live snapshot against ${corpus.meta.pageCount}-page corpus\n`);
const live = await collectLiveSnapshot({ documentedTools });

process.stdout.write(
  `  pacific  ${live.pacific.ok ? `chainId ${live.pacific.chainId}` : `FAILED: ${live.pacific.error}`}\n` +
    `  atlantic ${live.atlantic.ok ? `chainId ${live.atlantic.chainId}` : `FAILED: ${live.atlantic.error}`}\n` +
    `  mcp      ${live.mcp.ok ? `${live.mcp.toolCount} tools` : `FAILED: ${live.mcp.error}`}\n`,
);

// ------------------------------------------------------------------- chain

process.stdout.write("\nchain\n");

await test("the documented Pacific RPC answers eth_chainId", () => {
  assert.equal(live.pacific.ok, true, `pacific RPC failed: ${live.pacific.error}`);
  assert.equal(live.pacific.chainId, 1672, "Pacific must report chain ID 1672");
});

await test("the Atlantic RPC reports the chain ID the network page documents", () => {
  assert.equal(live.atlantic.ok, true, `atlantic RPC failed: ${live.atlantic.error}`);
  assert.equal(
    live.atlantic.chainId,
    688689,
    `Atlantic reports ${live.atlantic.chainId}; the network page says 688689, so either the page or the chain changed`,
  );
});

await test("exactly one of the two documented testnet hostnames is unusable (the current finding)", () => {
  const all = live.atlanticTls.all;
  assert.equal(all.length, 2, "both documented hostnames must be probed");
  const broken = all.filter((h) => !h.ok);
  // This assertion documents a real defect rather than wishing it away. If the
  // docs are fixed upstream, this test fails loudly and should be updated with
  // the new reality — that is the point of pinning it.
  assert.equal(broken.length, 1, `expected 1 broken hostname, saw ${broken.map((h) => h.host).join(", ") || "none"}`);
  assert.equal(broken[0].host, "testnet.dplabs-internal.com");
  assert.match(broken[0].error, /TLS certificate does not match/i);
});

// --------------------------------------------------------------------- mcp

process.stdout.write("\nMCP\n");

await test("the MCP /health response is the documented one", () => {
  assert.equal(live.mcp.ok, true, `MCP failed: ${live.mcp.error}`);
  assert.equal(live.mcp.healthOk, true);
  assert.equal(live.mcp.healthChainId, 1672);
});

await test("every tool documented in the MCP page exists on the server", () => {
  const actual = new Set(live.mcp.actual);
  const missing = documentedTools.filter((t) => !actual.has(t));
  assert.deepEqual(missing, [], `documented but not exposed: ${missing.join(", ")}`);
});

await test("every tool the server exposes is documented", () => {
  const documented = new Set(live.mcp.documented);
  const extra = live.mcp.actual.filter((t) => !documented.has(t));
  assert.deepEqual(extra, [], `exposed but not documented: ${extra.join(", ")}`);
});

await test("the tool list is at least the size the page implies", () => {
  assert.ok(live.mcp.toolCount >= 10, `only ${live.mcp.toolCount} tools listed`);
});

// ------------------------------------------------------------------- audit

process.stdout.write("\naudit with live evidence\n");

await test("the live-equipped audit leaves nothing unverified", () => {
  const audit = buildAudit({ corpus, live, generatedAt: live.fetchedAt });
  assert.equal(audit.summary.unverified, 0, "a live run should be able to verify every step");
  assert.equal(audit.summary.errors, 0);
  assert.equal(audit.summary.gaps, 6, "the journey currently has six gaps; update this if docs are fixed");
});

await test("the two steps that should resolve actually do", () => {
  const audit = buildAudit({ corpus, live, generatedAt: live.fetchedAt });
  const resolved = audit.results.filter((r) => r.status === "RESOLVED").map((r) => r.id).sort();
  assert.deepEqual(resolved, ["agent-mcp-wire-format", "network-pacific-rpc"]);
});

await test("both critical gaps are the network ones", () => {
  const audit = buildAudit({ corpus, live, generatedAt: live.fetchedAt });
  const critical = audit.results.filter((r) => r.status === "GAP" && r.severity === "CRITICAL").map((r) => r.id).sort();
  assert.deepEqual(critical, ["network-atlantic-chain-id", "network-atlantic-endpoint"]);
});

// ------------------------------------------------------------------ report

process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  process.stdout.write("\nfailures:\n");
  for (const f of failures) {
    process.stdout.write(`\n  ${f.name}\n    ${f.err.message}\n`);
  }
  process.exit(1);
}
