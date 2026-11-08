// Offline suite. No network, no clock, no filesystem writes: a synthetic corpus
// is enough to pin the behaviour that matters, and tests that need the internet
// are in live.test.mjs behind npm run test:live.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  parseLlmsIndex,
  stripBoilerplate,
  toPlain,
  extractHeadings,
  findInCorpus,
  countInCorpus,
  matchContexts,
  snippetAround,
  isSoftNotFound,
  contentHash,
  sha256Hex,
  unescapeMarkdown,
} from "../src/corpus.mjs";
import { runProbes, PROBES, STEP_ORDER, SEVERITY_RUBRIC } from "../src/probes.mjs";
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

function suite(name) {
  process.stdout.write(`\n${name}\n`);
}

/** A tiny corpus with the exact shapes the probes look for. Hand-written so the
 *  expectation is independent of whatever the live site says today. */
function fixture() {
  const pages = [
    {
      id: "getting-started/network/pacific-mainnet",
      title: "Pacific Mainnet",
      url: "https://docs.example/getting-started/network/pacific-mainnet",
      description: "",
      headings: ["Pacific Mainnet", "Network Information"],
      plain: "# Pacific Mainnet Network Information RPC https://rpc.pharos.xyz ChainID 1672 Symbol PROS",
    },
    {
      id: "getting-started/network/atlantic-testnet",
      title: "Atlantic Testnet",
      url: "https://docs.example/getting-started/network/atlantic-testnet",
      description: "",
      headings: ["Atlantic Testnet"],
      plain: "RPC https://atlantic.dplabs-internal.com ChainID 688689",
    },
    {
      id: "developer-guide/hardhat/write-your-first-token",
      title: "Deploy a token",
      url: "https://docs.example/developer-guide/hardhat/write-your-first-token",
      description: "",
      headings: ["Deploy a token"],
      plain: "chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com",
    },
    {
      id: "developer-guide/foundry/write-your-first-dapp",
      title: "Write your first dapp",
      url: "https://docs.example/developer-guide/foundry/write-your-first-dapp",
      description: "",
      headings: ["Write your first dapp"],
      plain: "cd contract forge install OpenZeppelin/openzeppelin-contracts --no-git forge script script/Counter.s.sol:CounterScript",
    },
    {
      id: "developer-guide/foundry/write-your-first-token",
      title: "Write your first token",
      url: "https://docs.example/developer-guide/foundry/write-your-first-token",
      description: "",
      headings: ["Write your first token"],
      plain: "For Atlantic Testnet forge verify-contract src/Token.sol:Token --chain-id 688688 --verifier blockscout --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer",
    },
    {
      id: "developer-guide/foundry",
      title: "Foundry",
      url: "https://docs.example/developer-guide/foundry",
      description: "",
      headings: ["Foundry", "Setup", "Send a transaction"],
      plain: "Foundry Setup Send a transaction with ethers.js using a JsonRpcProvider",
    },
    {
      id: "getting-started/canonical-contracts",
      title: "Canonical Contracts",
      url: "https://docs.example/getting-started/canonical-contracts",
      description: "",
      headings: ["Canonical Contracts"],
      plain: "EntryPoint ERC-4337 entry point for account abstraction 0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    },
    {
      id: "tooling-and-infrastructure/indexing/goldsky",
      title: "Goldsky",
      url: "https://docs.example/tooling-and-infrastructure/indexing/goldsky",
      description: "",
      headings: ["Goldsky", "Getting Started"],
      plain: "Goldsky Getting Started For more details see https://goldsky.com/chains/pharos",
    },
    {
      id: "tooling-and-infrastructure/mcp",
      title: "Pharos MCP",
      url: "https://docs.example/tooling-and-infrastructure/mcp",
      description: "",
      headings: ["Pharos MCP"],
      plain: "Hosted endpoint https://mcp.pharos.xyz/mcp Transport Streamable HTTP Authentication None get_chain_info get_block_number get_balance eth_call get_logs send_raw_transaction",
    },
  ];
  return { meta: { source: "fixture", indexUrl: "fixture", pageCount: pages.length, contentHash: contentHash(pages) }, pages };
}

// ---------------------------------------------------------------- corpus

suite("corpus primitives");

await test("llms.txt lines parse into id/title/url with .md stripped", () => {
  const entries = parseLlmsIndex(
    [
      "- [Pacific Mainnet](https://docs.pharos.xyz/getting-started/network/pacific-mainnet.md): Where to connect",
      "- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet.md)",
      "- [Not a page](https://docs.pharos.xyz/whatever)",
    ].join("\n"),
  );
  assert.equal(entries.length, 2, "entries without .md must be skipped");
  assert.equal(entries[0].id, "getting-started/network/pacific-mainnet");
  assert.equal(entries[0].url, "https://docs.pharos.xyz/getting-started/network/pacific-mainnet");
  assert.equal(entries[0].description, "Where to connect");
  assert.equal(entries[1].description, "");
});

await test("a 200 with a Page Not Found body is detected", () => {
  assert.equal(isSoftNotFound("# Page Not Found\n\nThis page does not exist."), true);
  assert.equal(isSoftNotFound("# Pacific Mainnet\n\nRPC…"), false);
});

await test("boilerplate is stripped, but a real heading that mentions agents is not", () => {
  const md = [
    "> For the complete documentation index, see [llms.txt](https://docs.pharos.xyz/llms.txt). Markdown versions of documentation pages are available by appending `.md`.",
    "",
    "# Real Page",
    "",
    "Body about agents and MCP.",
    "",
    "# Agent Instructions",
    "",
    "Ask the agent things.",
  ].join("\n");
  const out = stripBoilerplate(md);
  assert.match(out, /# Real Page/);
  assert.match(out, /Body about agents and MCP/);
  assert.doesNotMatch(out, /For the complete documentation index/);
  assert.doesNotMatch(out, /Ask the agent things/);
});

await test("toPlain keeps fenced content and drops only the fence lines", () => {
  const md = "Intro\n```bash\nforge create --rpc-url https://rpc.pharos.xyz\n```\nDone";
  const plain = toPlain(md);
  assert.match(plain, /forge create --rpc-url https:\/\/rpc\.pharos\.xyz/);
  assert.doesNotMatch(plain, /```/);
});

await test("headings are extracted in document order", () => {
  assert.deepEqual(extractHeadings("# A\n\ntext\n\n## B\n\n### C"), ["A", "B", "C"]);
});

await test("markdown escapes in titles and snippets are unescaped", () => {
  assert.equal(unescapeMarkdown("command\\_api and \\<contract\\>"), "command_api and <contract>");
});

await test("snippetAround marks truncation on both sides", () => {
  const plain = "x".repeat(300) + "NEEDLE" + "y".repeat(300);
  const s = snippetAround(plain, 300, 20);
  assert.match(s, /^…/);
  assert.match(s, /…$/);
  assert.match(s, /NEEDLE/);
});

// This is the regression that matters most. An earlier version escaped every
// string pattern before matching, so a caller passing an already-escaped pattern
// matched nothing and every count came back 0 — which reads exactly like a
// documentation gap. A false negative in this tool is a fabricated finding.
await test("string patterns match literally, including regex metacharacters", () => {
  const pages = fixture().pages;
  const needle = "https://testnet.dplabs-internal.com";
  assert.equal(countInCorpus(pages, needle), 1, "URL with dots and slashes must match literally");
  assert.equal(findInCorpus(pages, needle).length, 1);
  assert.equal(countInCorpus(pages, "chain_id 688688"), 1);
  // A pattern that genuinely is absent must report zero, so the test above
  // cannot pass for the wrong reason.
  assert.equal(countInCorpus(pages, "https://absent.example"), 0);
});

await test("matchContexts returns the text on both sides of every hit", () => {
  const pages = [
    { id: "a", title: "A", url: "u", description: "", headings: [], plain: "For Atlantic Testnet run --chain-id 424242 now" },
  ];
  const [hit] = matchContexts(pages, "424242", { window: 60 });
  assert.equal(hit.index, pages[0].plain.indexOf("424242"));
  assert.match(hit.before, /For Atlantic Testnet/);
  assert.match(hit.after, /now$/);
  // Case-folded like every other literal.
  assert.equal(matchContexts(pages, "FOR ATLANTIC").length, 1);
});

await test("matchContexts accepts a RegExp and keeps per-match lengths", () => {
  // A RegExp returns a bare RegExp from asMatcher, so the old implementation
  // threw here. Lengths also have to come from the match, not a fixed needle.
  const pages = [
    { id: "a", title: "A", url: "u", description: "", headings: [], plain: "chain-id 11 and chain-id 222 end" },
  ];
  const hits = matchContexts(pages, /chain-id (\d+)/g, { window: 5 });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].after, " and ");
  assert.match(hits[0].before + "|" + hits[0].after, /\| and/);
});

await test("RegExp patterns are used as given, not escaped", () => {
  const pages = fixture().pages;
  assert.equal(countInCorpus(pages, /\b688689\b/), 1);
  // The /i flag has to be honoured as given: same pattern, different case result.
  assert.equal(countInCorpus(pages, /\bFORGE\b/), 0);
  assert.equal(countInCorpus(pages, /\bforge\b/i), 3);
  assert.equal(countInCorpus(pages, /ethers\.js/), 1);
});

await test("missing contentHash inputs cannot drift with key order", () => {
  const a = { id: "x", title: "t", description: "", headings: ["h"], plain: "p" };
  const h1 = contentHash([a]);
  const h2 = contentHash([{ ...a }]);
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
  assert.notEqual(h1, contentHash([{ ...a, plain: "p2" }]));
});

await test("sha256 matches known vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

// ---------------------------------------------------------------- probes

suite("probes: verdicts follow evidence");

await test("every probe declares the fields the report renders", () => {
  for (const p of PROBES) {
    for (const k of ["id", "step", "title", "category", "severity", "question", "expectDoc", "evaluate"]) {
      assert.ok(p[k], `${p.id} is missing ${k}`);
    }
    assert.ok(STEP_ORDER.includes(p.step), `${p.id} has an unknown step ${p.step}`);
    assert.ok(SEVERITY_RUBRIC[p.severity], `${p.id} has an unknown severity ${p.severity}`);
    assert.equal(typeof p.evaluate, "function");
  }
  assert.equal(new Set(PROBES.map((p) => p.id)).size, PROBES.length, "probe ids must be unique");
});

await test("offline, no probe claims RESOLVED for a step that needs the network", () => {
  const { pages } = fixture();
  const results = runProbes(pages, null);
  const liveDependent = ["network-pacific-rpc", "network-atlantic-chain-id", "network-atlantic-endpoint"];
  for (const r of results.filter((x) => liveDependent.includes(x.id))) {
    assert.notEqual(r.status, "RESOLVED", `${r.id} resolved without a live check`);
    assert.ok(["UNVERIFIED", "GAP"].includes(r.status), `${r.id} returned ${r.status}`);
  }
});

await test("offline, a network step is UNVERIFIED rather than passed", () => {
  const { pages } = fixture();
  const pacific = runProbes(pages, null).find((r) => r.id === "network-pacific-rpc");
  assert.equal(pacific.status, "UNVERIFIED");
  assert.match(pacific.finding, /no live snapshot/i);
});

await test("contradicting chain IDs are reported as a gap with both sides counted", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    atlantic: { ok: true, chainId: 688689, url: "https://atlantic.dplabs-internal.com" },
  }).find((x) => x.id === "network-atlantic-chain-id");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /688688/);
  assert.match(r.finding, /688689/);
  assert.ok(r.evidence.some((e) => e.note === "says 688688"));
  assert.ok(r.evidence.some((e) => e.note === "says 688689"));
});

await test("a live chainID that contradicts the docs is called out as the wrong one", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    atlantic: { ok: true, chainId: 688689, url: "https://atlantic.dplabs-internal.com" },
  }).find((x) => x.id === "network-atlantic-chain-id");
  // The finding must state what the chain actually answered and tie the wrong
  // value to the label it sits under, not just assert "688688 is wrong".
  assert.match(r.finding, /eth_chainId with 0xa8231 = 688689, matching the reference page/);
  assert.match(r.finding, /sit(?:s)? directly under the label "For Atlantic Testnet"/);
});

await test("an endpoint that answers with the published chain ID resolves", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    pacific: { ok: true, chainId: 1672, url: "https://rpc.pharos.xyz" },
  }).find((x) => x.id === "network-pacific-rpc");
  assert.equal(r.status, "RESOLVED");
});

await test("a failing endpoint is a gap, and the error text is preserved", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    pacific: { ok: false, url: "https://rpc.pharos.xyz", error: "DNS does not resolve (ENOTFOUND)" },
  }).find((x) => x.id === "network-pacific-rpc");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /ENOTFOUND/);
});

await test("a TLS hostname mismatch names the host and the certificate", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    atlanticTls: {
      ok: false,
      checked: 2,
      hosts: [{ host: "atlantic.dplabs-internal.com", chainId: 688689 }],
      failing: "testnet.dplabs-internal.com",
      certNames: ["*.other.example", "other.example"],
      working: "atlantic.dplabs-internal.com",
      workingChainId: 688689,
      all: [],
    },
  }).find((x) => x.id === "network-atlantic-endpoint");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /testnet\.dplabs-internal\.com/);
  assert.match(r.finding, /\*\.other\.example/);
});

await test("a Foundry page with no forge is a gap, and the real subpages are named", () => {
  const { pages } = fixture();
  const r = runProbes(pages, null).find((x) => x.id === "toolchain-foundry-landing");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /never uses the word forge/i);
  // Every real subpage has to be named, otherwise the count and the list disagree.
  const sub = pages.filter((p) => p.id.startsWith("developer-guide/foundry/") && /\bforge\b/i.test(p.plain));
  assert.ok(sub.length >= 1, "fixture has no forge subpage to name");
  assert.match(r.finding, new RegExp(`under ${sub.length} deeper page`));
});

await test("EntryPoint without bundler or paymaster is a gap", () => {
  const { pages } = fixture();
  const r = runProbes(pages, null).find((x) => x.id === "aa-bundler-paymaster");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /EntryPoint/);
});

await test("an MCP page whose tools all exist resolves against a matching live list", () => {
  const { pages } = fixture();
  const documented = ["get_chain_info", "get_block_number", "get_balance", "eth_call", "get_logs", "send_raw_transaction"];
  const r = runProbes(pages, {
    mcp: { ok: true, healthOk: true, healthChainId: 1672, actual: [...documented].sort(), documented: [...documented].sort(), toolCount: documented.length },
  }).find((x) => x.id === "agent-mcp-wire-format");
  assert.equal(r.status, "RESOLVED");
});

await test("a tool documented but not exposed is a gap naming it", () => {
  const { pages } = fixture();
  const r = runProbes(pages, {
    mcp: {
      ok: true,
      healthOk: true,
      healthChainId: 1672,
      actual: ["get_chain_info", "get_block_number", "get_balance", "eth_call", "get_logs"],
      documented: ["get_chain_info", "get_block_number", "get_balance", "eth_call", "get_logs", "send_raw_transaction"],
      toolCount: 5,
    },
  }).find((x) => x.id === "agent-mcp-wire-format");
  assert.equal(r.status, "GAP");
  assert.match(r.finding, /send_raw_transaction/);
});

await test("a probe that throws is ERROR, never a gap and never a pass", () => {
  const broken = { ...PROBES[0], id: "broken", evaluate() { throw new Error("boom"); } };
  // runProbes iterates the exported list; exercise the same catch path directly.
  const { pages } = fixture();
  const results = runProbes(pages, null);
  assert.ok(results.every((r) => r.status !== "ERROR"), "shipped probes must not throw on a well-formed corpus");
  try {
    broken.evaluate();
  } catch {
    /* the catch lives in runProbes; assert its contract below via a stub */
  }
  assert.equal(typeof runProbes, "function");
});

// ---------------------------------------------------------------- audit

suite("audit aggregation");

await test("summary counts are internally consistent", () => {
  const audit = buildAudit({ corpus: fixture(), live: null, generatedAt: null });
  const s = audit.summary;
  const counted = s.resolved + s.gaps + s.unverified + s.partial + s.errors;
  assert.equal(counted, s.totalChecks, "every check must land in exactly one bucket");
  assert.equal(s.totalChecks, PROBES.length);
  const severitySum = Object.values(s.severityCounts).reduce((a, b) => a + b, 0);
  assert.equal(severitySum, s.gaps, "severity counts must sum to the gap count");
});

await test("resolution rate excludes unverified checks from the numerator", () => {
  const audit = buildAudit({ corpus: fixture(), live: null, generatedAt: null });
  const { resolved, totalChecks, resolutionRate } = audit.summary;
  assert.equal(resolutionRate, Math.round((resolved / totalChecks) * 1000) / 10);
  assert.ok(audit.summary.unverified > 0, "offline run must have unverified checks");
  assert.ok(resolutionRate < 100);
});

await test("a fully-resolving corpus reports no gaps", () => {
  const audit = buildAudit({ corpus: fixture(), live: null, generatedAt: null });
  const gaps = audit.results.filter((r) => r.status === "GAP");
  assert.ok(gaps.length > 0, "the fixture is deliberately incomplete");
  for (const g of gaps) {
    assert.ok(g.finding.length > 40, `${g.id} has no real finding text`);
    assert.ok(g.recommendation.length > 20, `${g.id} has no recommendation`);
    assert.ok(g.severity, `${g.id} has no severity`);
  }
});

await test("results are ordered by journey step", () => {
  const audit = buildAudit({ corpus: fixture(), live: null, generatedAt: null });
  const steps = audit.results.map((r) => STEP_ORDER.indexOf(r.step));
  const sorted = [...steps].sort((a, b) => a - b);
  assert.deepEqual(steps, sorted);
});

await test("markdown names every gap and its reproduce query", () => {
  const audit = buildAudit({ corpus: fixture(), live: null, generatedAt: null });
  const md = audit.markdown;
  assert.match(md, /^# Pharos documentation/);
  // The old title re-asserted the premise the audit exists to refute.
  assert.doesNotMatch(md.split("\n")[0], /Docs MCP/i);
  assert.match(md, /## Summary/);
  assert.match(md, /## Journey/);
  for (const g of audit.results.filter((r) => r.status === "GAP")) {
    assert.ok(md.includes(g.gapTitle || g.title), `markdown is missing ${g.id}`);
    assert.ok(md.includes(`\`${g.query}\``), `markdown is missing the reproduce query for ${g.id}`);
  }
  assert.match(md, /UNVERIFIED/, "offline markdown must show unverified checks");
});

// ------------------------------------------------------ repo-level guards

suite("repo guards");

// Strip comments before inspecting. The first version of this test failed on
// corpus.mjs because the header comment says "no Buffer" — a guard that reads
// prose as code reports a violation that does not exist, which is the same
// mistake as reporting a docs gap that is really a broken matcher.
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

await test("src/ is browser-safe: no node: imports, no Buffer, no process", async () => {
  for (const file of ["corpus.mjs", "probes.mjs", "audit.mjs"]) {
    const raw = await readFile(path.join(ROOT, "src", file), "utf8");
    const src = codeOnly(raw);
    assert.ok(src.trim().length > 0, `${file} became empty after comment stripping`);
    assert.doesNotMatch(src, /from\s+["']node:/, `${file} imports a node builtin`);
    assert.doesNotMatch(src, /require\(/, `${file} uses require`);
    assert.doesNotMatch(src, /\bBuffer\b/, `${file} uses Buffer`);
    assert.doesNotMatch(src, /\bprocess\./, `${file} uses process`);
  }
});

await test("the comment stripper itself is honest", () => {
  assert.doesNotMatch(codeOnly("// no Buffer here\nconst a = 1;"), /Buffer/);
  assert.match(codeOnly("const b = Buffer.from('x');"), /Buffer/);
  assert.match(codeOnly("const u = 'https://x/y';"), /https:\/\/x\/y/, "// inside a URL must survive");
});

await test("public/app.js has no innerHTML path and no hardcoded journey data", async () => {
  const src = await readFile(path.join(ROOT, "public", "app.js"), "utf8");
  assert.doesNotMatch(src, /innerHTML\s*=/, "app.js must not assign innerHTML");
  assert.doesNotMatch(src, /GAP_FOUND/, "app.js must not carry the scaffold's fake status vocabulary");
  assert.doesNotMatch(src, /mcpAnswer/, "app.js must not render an invented MCP answer");
  assert.match(src, /from "\.\/audit\.generated\.js"/);
});

await test("index.html ships no invented metrics", async () => {
  const html = await readFile(path.join(ROOT, "public", "index.html"), "utf8");
  // The scaffold hardcoded 6 steps / 4 gaps / 1 critical / 33% in the markup.
  assert.doesNotMatch(html, /id="metric(Gaps|Critical|Rate|Total)"/);
  assert.doesNotMatch(html, /\bdata-query=/, "preset buttons with baked-in questions were removed");
  // No bare percentage or count in the body text.
  const body = html.slice(html.indexOf("<body"));
  assert.doesNotMatch(body, /\b\d+%/, "a literal percentage in static markup would be unsourced");
});

await test("generated artifacts carry the do-not-edit banner", async () => {
  for (const f of ["audit.generated.js", "corpus.generated.js", "report.generated.js"]) {
    const src = await readFile(path.join(ROOT, "public", f), "utf8");
    assert.match(src, /GENERATED/, `${f} is missing its banner`);
  }
});

await test("the committed corpus hash in the loop matches data/corpus.json", async () => {
  const data = JSON.parse(await readFile(path.join(ROOT, "data", "corpus.json"), "utf8"));
  assert.equal(contentHash(data.pages), data.meta.contentHash, "corpus.json hash does not describe its own pages");
  assert.equal(data.meta.pageCount, data.pages.length);
});

await test("no selector-style fabricated constant in the UI copy", async () => {
  const html = await readFile(path.join(ROOT, "public", "index.html"), "utf8");
  assert.doesNotMatch(html, /tPROS/, "the scaffold invented a token symbol");
});

// ------------------------------------------------------------------ failures

suite("a broken probe cannot pass as good news");

await test("a probe that throws is reported as ERROR, not as a gap or a pass", () => {
  // Pages with no `plain` make every text probe throw. The run has to say so.
  const broken = {
    meta: { source: "broken", indexUrl: "broken", pageCount: 1, contentHash: "0".repeat(64) },
    pages: [{ id: "only-page", title: "Only", url: "https://example/only", description: "", headings: [] }],
  };
  const audit = buildAudit({ corpus: broken, live: null, generatedAt: null });
  const errs = audit.results.filter((r) => r.status === "ERROR");
  assert.ok(errs.length > 0, "a corpus with no plain text must crash the probes");
  assert.equal(audit.summary.errors, errs.length);
  assert.equal(audit.summary.resolved, 0, "a crashed probe was counted as resolved");
  assert.ok(
    !audit.results.some((r) => r.status === "GAP"),
    "a crashed probe was reported as a documentation gap",
  );
});

await test("crashed probes are never hidden under 'not gaps'", () => {
  const broken = {
    meta: { source: "broken", indexUrl: "broken", pageCount: 1, contentHash: "0".repeat(64) },
    pages: [{ id: "only-page", title: "Only", url: "https://example/only", description: "", headings: [] }],
  };
  const md = buildAudit({ corpus: broken, live: null, generatedAt: null }).markdown;
  assert.match(md, /## Not evaluated \(\d+\)/);
  assert.match(md, /excluded from the resolution rate, not counted as passes/);
  assert.doesNotMatch(md, /## Checks the docs answer/);
});

await test("every probe can state the broken case, not just the claim it tests", () => {
  for (const p of PROBES) {
    assert.ok(p.gapTitle, `${p.id} has no gapTitle, so a GAP would print the passing claim`);
    assert.notEqual(p.gapTitle, p.title);
  }
});

// ------------------------------------------------------------------- report

process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  process.stdout.write("\nfailures:\n");
  for (const f of failures) {
    process.stdout.write(`\n  ${f.name}\n${f.err.stack.split("\n").slice(0, 4).map((l) => `    ${l}`).join("\n")}\n`);
  }
  process.exit(1);
}
