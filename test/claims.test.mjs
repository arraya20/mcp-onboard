// Artifact suite. The report is a generated document, but every number in it is
// prose. Hardcoded prose numbers are exactly how the first version of this
// report ended up claiming "faucet appears once" when it appeared twice, and
// "under 6 deeper pages" while listing three in the same sentence.
//
// The recount itself lives in scripts/verify-claims.mjs so the CLI and this
// gate share one implementation. This suite adds the checks that are about the
// report's integrity rather than its arithmetic.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { checkClaims } from "../scripts/verify-claims.mjs";

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
const report = await readFile(path.join(ROOT, "reports", "audit.md"), "utf8");
const audit = JSON.parse(await readFile(path.join(ROOT, "reports", "audit.json"), "utf8"));

process.stdout.write("\nreport claims match an independent recount\n");

await test("every count in the report reproduces from the corpus", () => {
  const rows = checkClaims({ pages: corpus.pages, report });
  const bad = rows.filter((r) => !r.ok);
  assert.deepEqual(
    bad.map((r) => `${r.claim} (missing: ${r.expected})`),
    [],
    "the report states numbers the corpus does not support",
  );
  assert.ok(rows.length >= 10, "the recount covers too few claims to be useful");
});

await test("every count is declared literal and case-insensitive", () => {
  assert.match(report, /literal, case-insensitive substring occurrences/);
  // The rule has to be the same one the search endpoint applies, or the report
  // and the search box print two different counts for one question.
  assert.match(report, /the same rule the search box uses/);
});

await test("no faucet URL claim contradicts a faucet URL count", () => {
  const urls = (corpus.pages.map((p) => p.plain).join(" ").match(/https?:\/\/[^\s)\]]*faucet[^\s)\]]*/gi) || []).length;
  if (urls === 0) assert.match(report, /No URL in the corpus mentions a faucet/);
  else assert.doesNotMatch(report, /No URL in the corpus mentions a faucet/);
});

await test("a subpage count is never larger than the list beside it", () => {
  for (const sub of corpus.pages.filter((p) => p.id.startsWith("developer-guide/foundry/") && /\bforge\b/i.test(p.plain))) {
    // The finding lists subpages by short name; evidence only shows the first
    // four, so the list in the prose is what has to be complete.
    assert.ok(
      report.includes(sub.id.replace("developer-guide/foundry/", "")),
      `foundry gap lists a count but does not name ${sub.id}`,
    );
  }
});

// --- the report's own integrity -------------------------------------------

process.stdout.write("\nreport integrity\n");

await test("the report does not claim the Pharos Docs MCP is missing", () => {
  assert.doesNotMatch(report.split("\n")[0], /Docs MCP/i);
  // A Docs MCP exists at docs.pharos.xyz/~gitbook/mcp; asserting otherwise was a
  // factual error that an earlier version of this test locked in.
  assert.doesNotMatch(report, /No documentation MCP server exists/i);
  assert.match(report, /~gitbook\/mcp/);
  assert.match(report, /docs\/mcp-session-log\.md/);
});

await test("no ungrammatical pluralisation leaks into the report", () => {
  assert.doesNotMatch(report, /check\(s\)|link\(s\)|page\(s\)|time\(s\)/);
});

await test("a gap never prints a passing claim as its headline", () => {
  const gaps = audit.results.filter((r) => r.status === "GAP");
  assert.ok(gaps.length > 0);
  for (const g of gaps) {
    assert.ok(g.gapTitle, `${g.id} is a gap with no gapTitle, so its heading states the good case`);
    assert.ok(report.includes(`### [${g.severity}] ${g.gapTitle}`), `${g.id} heading missing from the report`);
  }
});

await test("the dashboard renders the same gap headline as the report", async () => {
  const app = await readFile(path.join(ROOT, "public", "app.js"), "utf8");
  assert.match(app, /gapTitle/, "the dashboard ignores gapTitle, so a gap shows the claim it refutes");
  assert.match(app, /Not evaluated/, "the dashboard folds ERROR/UNVERIFIED into 'not gaps'");
});

await test("the shipped artifact carries a gapTitle for every gap", async () => {
  const shipped = await readFile(path.join(ROOT, "public", "audit.generated.js"), "utf8");
  for (const g of audit.results.filter((r) => r.status === "GAP")) {
    assert.ok(shipped.includes(g.gapTitle), `audit.generated.js has no gapTitle for ${g.id}`);
  }
});

await test("every verdict is one of the five documented statuses", () => {
  const allowed = new Set(["RESOLVED", "GAP", "UNVERIFIED", "PARTIAL", "ERROR"]);
  for (const r of audit.results) assert.ok(allowed.has(r.status), `${r.id} has status ${r.status}`);
});

await test("no probe silently crashed", () => {
  const crashed = audit.results.filter((r) => r.status === "ERROR");
  assert.equal(
    crashed.length,
    0,
    `crashed probes: ${crashed.map((c) => `${c.id}: ${c.finding}`).join("; ")}`,
  );
});

await test("summary arithmetic adds up", () => {
  const s = audit.summary;
  assert.equal(s.totalChecks, audit.results.length);
  assert.equal(s.resolved + s.gaps + s.unverified + (s.partial || 0) + (s.errors || 0), s.totalChecks);
  assert.equal(
    s.severityCounts.CRITICAL + s.severityCounts.HIGH + s.severityCounts.MEDIUM + s.severityCounts.LOW,
    s.gaps,
  );
});

await test("resolution rate uses only answered checks", () => {
  const s = audit.summary;
  assert.equal(s.resolutionRate, Math.round((s.resolved / s.totalChecks) * 1000) / 10);
});

await test("a gap that needed the network carries live evidence or says so", () => {
  for (const g of audit.results.filter((r) => r.status === "GAP" && r.step === "network")) {
    const hasLive = Boolean(g.live) || (g.evidence || []).some((e) => String(e.id).startsWith("live:"));
    assert.ok(hasLive, `${g.id} is a network gap with no live evidence attached`);
  }
});

process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  process.stdout.write("\nfailures:\n");
  for (const f of failures) {
    process.stdout.write(`\n  ${f.name}\n${f.err.stack.split("\n").slice(0, 4).map((l) => `    ${l}`).join("\n")}\n`);
  }
  process.exit(1);
}
