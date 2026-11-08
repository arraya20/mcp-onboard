// API suite. Imports the Pages Function directly and calls it with real Request
// objects — no wrangler needed, so this runs in CI and on a laptop alike.
//
// What it pins down is the difference between "empty" and "broken". An endpoint
// that returns 200 with an empty list when its artifact is missing is worse than
// one that fails: the caller cannot tell "the docs have nothing on this" from
// "the tool never looked".

import assert from "node:assert/strict";
import { onRequestGet, onRequestOptions } from "../functions/api/report.js";

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

const call = (qs = "") => onRequestGet({ request: new Request(`https://example.test/api/report${qs}`) });

// ------------------------------------------------------------------- report

process.stdout.write("\nGET /api/report\n");

await test("returns the audit snapshot with a 200", async () => {
  const res = await call();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.audit, "missing audit key");
  assert.ok(Array.isArray(body.audit.results));
  assert.ok(body.audit.summary.totalChecks > 0);
  assert.equal(body.audit.corpus.contentHash.length, 64);
});

await test("does not ship the markdown twice", async () => {
  const body = await (await call()).json();
  assert.equal(body.audit.markdown, undefined, "markdown belongs in format=md, not the JSON snapshot");
});

await test("every result a client can render carries a status and a title", async () => {
  const body = await (await call()).json();
  const allowed = new Set(["RESOLVED", "GAP", "UNVERIFIED", "PARTIAL", "ERROR"]);
  for (const r of body.audit.results) {
    assert.ok(allowed.has(r.status), `unknown status ${r.status} on ${r.id}`);
    assert.ok(r.title && r.severity && r.question);
    if (r.status === "GAP") {
      assert.ok(r.finding.length > 40, `${r.id} gap has no finding`);
      assert.ok(r.recommendation.length > 20, `${r.id} gap has no recommendation`);
    }
  }
});

await test("CORS and caching headers are explicit", async () => {
  const res = await call();
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("cache-control") || "", /max-age/);
});

// ------------------------------------------------------------------- search

process.stdout.write("\nGET /api/report?q=\n");

await test("a documented term returns real page hits with snippets", async () => {
  const res = await call("?q=faucet");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.matchCount >= 1, "the corpus does mention a faucet in prose");
  for (const m of body.matches) {
    assert.ok(m.id && m.url.startsWith("https://docs.pharos.xyz/"));
    assert.ok(m.snippet.length > 0);
    assert.ok(m.occurrences >= 1);
  }
});

await test("search is literal: a regex-looking query is not interpreted", async () => {
  const literal = await (await call("?q=688689")).json();
  assert.ok(literal.matchCount >= 1);
  const wildcard = await (await call("?q=68.*89")).json();
  assert.equal(wildcard.matchCount, 0, "a regex would have matched; literal search must not");
});

await test("a hit really contains the needle", async () => {
  const body = await (await call("?q=bundler")).json();
  if (body.matchCount === 0) {
    assert.match(body.note, /not proof/i);
    return;
  }
  for (const m of body.matches.slice(0, 3)) {
    assert.ok(
      m.snippet.toLowerCase().includes("bundler"),
      `snippet for ${m.id} does not contain the query`,
    );
  }
});

await test("zero matches is a 200 that states its own limit", async () => {
  const body = await (await call("?q=zzzz-no-such-term-zzzz")).json();
  assert.equal(body.ok, true);
  assert.equal(body.matchCount, 0);
  assert.match(body.note, /not proof|documented/i);
  assert.equal(body.corpus.pageCount > 0, true, "still reports how much was searched");
});

await test("empty q is a 400, not a full-corpus dump", async () => {
  const res = await call("?q=");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /empty/i);
});

await test("whitespace-only q is a 400", async () => {
  assert.equal((await call("?q=%20%20")).status, 400);
});

await test("an over-long q is rejected with the limit named", async () => {
  const res = await call(`?q=${"a".repeat(201)}`);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /200/);
});

await test("q at exactly the limit is accepted", async () => {
  const res = await call(`?q=${"a".repeat(200)}`);
  assert.equal(res.status, 200);
});

// ----------------------------------------------------------------- markdown

process.stdout.write("\nGET /api/report?format=md\n");

await test("serves the report as markdown", async () => {
  const res = await call("?format=md");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/markdown/);
  const text = await res.text();
  assert.match(text, /^# Pharos documentation/);
  assert.doesNotMatch(text.split("\n")[0], /Docs MCP/i);
  assert.match(text, /## Summary/);
  assert.match(text, /## Gaps/);
});

await test("the markdown body matches the JSON snapshot's claims", async () => {
  const body = await (await call()).json();
  const md = await (await call("?format=md")).text();
  for (const g of body.audit.results.filter((r) => r.status === "GAP")) {
    // The markdown prints the broken-case headline, which is gapTitle.
    assert.ok(md.includes(g.gapTitle || g.title), `markdown omits ${g.id}`);
  }
});

await test("serves the Docs MCP session log as markdown and JSON", async () => {
  const mdRes = await call("?format=mcp-md");
  assert.equal(mdRes.status, 200);
  assert.match(mdRes.headers.get("content-type") || "", /text\/markdown/);
  const md = await mdRes.text();
  assert.match(md, /^# Docs MCP onboarding — session log/);
  assert.match(md, /## Step-by-step log/);
  assert.match(md, /## Gaps and suggested fixes/);
  assert.match(md, /## What I managed to build or run by the end/);

  const jsonRes = await call("?format=mcp");
  assert.equal(jsonRes.status, 200);
  const body = await jsonRes.json();
  assert.equal(body.ok, true);
  assert.equal(body.mcpSession.summary.totalSteps, 9);
  assert.equal(body.mcpSession.summary.gaps, 7);
});

// ------------------------------------------------------------------ options

process.stdout.write("\nOPTIONS\n");

await test("preflight returns 204 with the allowed methods", async () => {
  const res = await onRequestOptions();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-methods"), "GET, OPTIONS");
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
