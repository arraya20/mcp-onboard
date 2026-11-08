#!/usr/bin/env node
// Replays the onboarding journey against the Pharos Developer Docs MCP and writes
// the session down: every tool call, its exact arguments, and the verbatim answer.
//
//   node scripts/mcp-session.mjs            # run all steps, write data/ + docs/
//   node scripts/mcp-session.mjs --render   # re-render docs/mcp-session-log.md
//                                           # from data/mcp-session.json (no network)
//   node scripts/mcp-session.mjs --check    # fail if the committed log is not exactly
//                                           # what the raw session renders to
//
// Rules this script holds itself to:
//   * The ONLY documentation source is the Docs MCP (searchDocumentation, getPage,
//     askQuestion). It never fetches docs.pharos.xyz over plain HTTP.
//   * A call that fails is recorded as a failed call, with the error. It is never
//     retried silently into success and never dropped.
//   * A verdict is derived from the recorded answer by a stated rule, so it can be
//     re-derived with --render. The answer is quoted, not paraphrased.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_MCP_URL, initialize, listTools, callTool } from "../src/docsmcp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = resolve(ROOT, "data/mcp-session.json");
const LOG = resolve(ROOT, "docs/mcp-session-log.md");
const ARTIFACT = resolve(ROOT, "public/mcp-session.generated.js");

/** Drop the trailing "# Sources" list: a source *title* is not evidence of content. */
const body = (t) => (t || "").split(/\n# Sources\b/)[0];
const call = (s, i) => s.calls[i]?.answer || "";

// ---------------------------------------------------------------- the journey
// `goal` is what a first-time developer is trying to do. Each call is a question
// they would actually type. `judge` reads the recorded answers and returns the
// verdict plus the rule it applied.

export const STEPS = [
  {
    id: "chain-id",
    title: "Which chain ID is Atlantic Testnet?",
    severity: "CRITICAL",
    goal: "Find the chain ID to pass to `forge verify-contract --chain-id`.",
    calls: [
      { tool: "askQuestion", args: { question: "What is the chain ID, RPC URL and block explorer for Pharos Atlantic Testnet?" } },
      { tool: "askQuestion", args: { question: "Which chain ID do I pass to forge verify-contract --chain-id for Atlantic Testnet? Is 688688 a valid Pharos chain ID?" } },
      { tool: "searchDocumentation", args: { query: "688688" } },
    ],
    judge(s) {
      const a = body(call(s, 1));
      const conceded = /incorrectly|different Pharos testnet/i.test(a);
      return conceded
        ? { status: "GAP", rule: "The Docs MCP answer itself says 688688 belongs to a different testnet and that some Foundry examples wrongly use it for Atlantic." }
        : { status: "RESOLVED", rule: "No contradiction surfaced in the answer." };
    },
    fix: "Use 688689 in every Atlantic example (Foundry `forge verify-contract` on write-your-first-nft and write-your-first-token, Hardhat `chain_id`). If a second 'Testnet' (688688) is real, give it its own page under getting-started/network/ with RPC, explorer and status, or remove it.",
  },
  {
    id: "quickstart-rpc",
    title: "Does the quickstart's testnet RPC connect?",
    severity: "CRITICAL",
    goal: "Paste the RPC URL from the Hardhat guide into `hardhat.config` and connect.",
    calls: [
      { tool: "askQuestion", args: { question: "What RPC URL should I put in my Hardhat config for the Pharos testnet?" } },
      { tool: "searchDocumentation", args: { query: "testnet.dplabs-internal.com" } },
    ],
    judge(s) {
      const stale = /testnet\.dplabs-internal\.com/i.test(call(s, 1));
      const ok = /atlantic\.dplabs-internal\.com/i.test(body(call(s, 0)));
      return stale
        ? { status: "GAP", rule: `The assistant answers correctly (${ok ? "atlantic.dplabs-internal.com" : "?"}), but the pages a developer actually copies from still contain testnet.dplabs-internal.com. TLS for that host is checked separately in the live audit (certificate for *.zan.top).` }
        : { status: "RESOLVED", rule: "The stale host no longer appears in search results." };
    },
    fix: "Replace testnet.dplabs-internal.com with atlantic.dplabs-internal.com in the Hardhat guides (or fix the certificate), and retire testnet.pharosscan.xyz (expired certificate) in favour of atlantic.pharosscan.xyz.",
  },
  {
    id: "pacific-rpc",
    title: "Pacific Mainnet endpoint",
    severity: null,
    goal: "Connect to mainnet.",
    calls: [{ tool: "askQuestion", args: { question: "What is the Pacific mainnet RPC URL and chain ID?" } }],
    judge(s) {
      const a = body(call(s, 0));
      return /rpc\.pharos\.xyz/.test(a) && /\b1672\b/.test(a)
        ? { status: "RESOLVED", rule: "Answer gives https://rpc.pharos.xyz and chain ID 1672 (verified against the chain in the live audit)." }
        : { status: "GAP", rule: "Answer is missing the RPC URL or chain ID." };
    },
    fix: null,
  },
  {
    id: "faucet",
    title: "Where do I get testnet PHRS?",
    severity: "HIGH",
    goal: "Fund a wallet so I can pay gas for a deploy.",
    calls: [
      { tool: "askQuestion", args: { question: "Where do I get Atlantic testnet PHRS from a faucet? Give the URL." } },
      { tool: "searchDocumentation", args: { query: "faucet" } },
    ],
    judge(s) {
      const urlNearFaucet = /https?:\/\/[^\s)>\]]*faucet[^\s)>\]]*/i.exec(`${body(call(s, 0))}\n${call(s, 1)}`);
      return urlNearFaucet
        ? { status: "RESOLVED", rule: `A faucet URL was returned: ${urlNearFaucet[0]}` }
        : { status: "GAP", rule: "Neither the answer nor the search results contain a URL for a faucet. The assistant says the docs name a faucet without linking it." };
    },
    fix: "On the Atlantic Testnet page, next to the RPC details, publish the faucet URL, its per-address limit and any eligibility rule. Remove 'or directly from the team' unless there is a way to reach the team.",
  },
  {
    id: "foundry",
    title: "Where is `forge` in the Foundry guide?",
    severity: "MEDIUM",
    goal: "Follow the Foundry guide to compile and deploy a Solidity contract.",
    calls: [
      { tool: "getPage", args: { url: "https://docs.pharos.xyz/developer-guide/foundry" } },
      { tool: "searchDocumentation", args: { query: "forge script deploy Atlantic" } },
    ],
    judge(s) {
      const page = call(s, 0);
      return /\bforge\b/i.test(page)
        ? { status: "RESOLVED", rule: "The Foundry landing page mentions forge." }
        : { status: "GAP", rule: "The page titled 'Foundry' (fetched with getPage) never says `forge`." };
    },
    fix: "Retitle the page to what it is (send a transaction with ethers.js) and add a real Foundry landing page: `forge init`, `forge create`/`forge script` against Atlantic, `forge verify-contract` with the correct chain ID. Or move that content up from write-your-first-*.",
  },
  {
    id: "account-abstraction",
    title: "Bundler and paymaster for ERC-4337",
    severity: "HIGH",
    goal: "Send a UserOperation using the published EntryPoint.",
    calls: [
      { tool: "askQuestion", args: { question: "Is there a public ERC-4337 bundler RPC and a paymaster on Pharos?" } },
      { tool: "searchDocumentation", args: { query: "bundler paymaster UserOperation" } },
    ],
    judge(s) {
      const hit = /bundler|paymaster/i.test(call(s, 1));
      return hit
        ? { status: "PARTIAL", rule: "Search results mention a bundler or paymaster; read them to check they give an endpoint." }
        : { status: "GAP", rule: "searchDocumentation for 'bundler paymaster UserOperation' returns pages that never contain either word (only the EntryPoint address)." };
    },
    fix: "Add an ERC-4337 page: bundler RPC URL(s) and rate limits, whether a paymaster exists on Atlantic, and a minimal UserOperation against the EntryPoint already listed on Canonical Contracts.",
  },
  {
    id: "indexing",
    title: "Index my contract with Goldsky",
    severity: "MEDIUM",
    goal: "Get a subgraph indexing the contract I deployed.",
    calls: [
      { tool: "getPage", args: { url: "https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky" } },
      { tool: "askQuestion", args: { question: "How do I index my contract events with a subgraph on Pharos using Goldsky?" } },
    ],
    judge(s) {
      const page = call(s, 0);
      const actionable = /subgraph\.yaml|goldsky subgraph|api[- ]key|goldsky login|graphql/i.test(page);
      return actionable
        ? { status: "RESOLVED", rule: "The Goldsky page contains a concrete step." }
        : { status: "GAP", rule: `The Goldsky page (${page.length} chars as returned by getPage, markup included; the audit's plain-text count is smaller) has no CLI command, API-key step, subgraph config or query example.` };
    },
    fix: "Add the Pharos network name for the Goldsky CLI, the login/API-key step, a minimal subgraph.yaml and a query example, or link directly to Goldsky's Pharos quickstart.",
  },
  {
    id: "agent-access",
    title: "Connect an agent over MCP",
    severity: null,
    goal: "Let an AI agent read the chain.",
    calls: [{ tool: "askQuestion", args: { question: "How do I connect an AI agent to Pharos over MCP? Endpoint, transport, auth, tools?" } }],
    judge(s) {
      const a = body(call(s, 0));
      return /mcp\.pharos\.xyz/i.test(a) && /(stream|http)/i.test(a)
        ? { status: "RESOLVED", rule: "Answer names the endpoint and transport (the chain MCP page is verified tool-by-tool in the live audit)." }
        : { status: "GAP", rule: "Answer is missing the endpoint or transport." };
    },
    fix: null,
  },
  {
    id: "docs-mcp-discovery",
    title: "How do I find the Docs MCP itself?",
    severity: "LOW",
    goal: "Start from the docs and learn that a Developer Docs MCP exists and where it lives.",
    calls: [
      { tool: "searchDocumentation", args: { query: "docs MCP server endpoint ~gitbook/mcp" } },
      { tool: "askQuestion", args: { question: "Is there a documentation MCP server for docs.pharos.xyz, and what is its URL?" } },
    ],
    judge(s) {
      const hit = /gitbook\/mcp/i.test(`${call(s, 0)}\n${call(s, 1)}`);
      return hit
        ? { status: "RESOLVED", rule: "The Docs MCP URL appears in an answer." }
        : { status: "GAP", rule: "Neither the search nor the answer contains the Docs MCP URL; only the chain MCP (mcp.pharos.xyz) is documented." };
    },
    fix: "Add a short 'Use these docs from your AI client' section (docs.pharos.xyz/~gitbook/mcp, tools searchDocumentation / getPage / askQuestion, a Claude/Cursor config snippet) and link it from ai.pharos.xyz and from the chain MCP page, so the two MCP servers are not confused.",
  },
];

// ---------------------------------------------------------------------- run
async function timed(fn) {
  const t0 = Date.now();
  try {
    return { ok: true, answer: await fn(), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String(e.message || e), ms: Date.now() - t0 };
  }
}

async function run() {
  const startedAt = new Date().toISOString();
  const init = await initialize();
  const tools = (await listTools()).map((t) => ({ name: t.name, description: t.description }));
  process.stdout.write(`${init.serverInfo.name} v${init.serverInfo.version}: ${tools.map((t) => t.name).join(", ")}\n`);

  const session = {
    endpoint: DOCS_MCP_URL,
    server: init.serverInfo,
    protocolVersion: init.protocolVersion,
    tools,
    startedAt,
    steps: [],
  };
  mkdirSync(dirname(RAW), { recursive: true });

  for (const step of STEPS) {
    const rec = { id: step.id, calls: [] };
    for (const c of step.calls) {
      process.stdout.write(`  ${step.id}  ${c.tool} ${JSON.stringify(c.args)}\n`);
      const r = await timed(() => callTool(c.tool, c.args, { timeoutMs: 120000 }));
      rec.calls.push({ tool: c.tool, args: c.args, ...r });
      process.stdout.write(`    ${r.ok ? `ok ${r.answer.length} chars` : `FAILED ${r.error}`} (${r.ms} ms)\n`);
    }
    session.steps.push(rec);
    session.finishedAt = new Date().toISOString();
    writeFileSync(RAW, JSON.stringify(session, null, 2) + "\n"); // save as we go
  }
  return session;
}

// ------------------------------------------------------------------- render
const fence = (t) => {
  const f = t.includes("```") ? "~~~~" : "```";
  return `${f}\n${t.trim()}\n${f}`;
};
const quote = (t) => t.trim().split("\n").map((l) => `> ${l}`.trimEnd()).join("\n");

function splitSources(t) {
  const i = t.search(/\n# Sources\b/);
  return i < 0 ? { main: t, sources: "" } : { main: t.slice(0, i), sources: t.slice(i).replace(/^\n# Sources\s*/, "") };
}

export function render(session) {
  const rows = STEPS.map((step, i) => {
    const rec = session.steps.find((s) => s.id === step.id);
    const failed = rec.calls.filter((c) => !c.ok);
    const s = { calls: rec.calls.map((c) => ({ ...c, answer: c.answer || "" })) };
    const v = failed.length
      ? { status: "ERROR", rule: `${failed.length} call(s) failed: ${failed.map((f) => f.error).join("; ")}` }
      : step.judge(s);
    return { n: i + 1, step, rec, v };
  });

  const gaps = rows.filter((r) => r.v.status === "GAP");
  const resolved = rows.filter((r) => r.v.status === "RESOLVED");
  const errors = rows.filter((r) => r.v.status === "ERROR");
  const out = [];

  out.push("# Docs MCP onboarding — session log");
  out.push("");
  out.push(
    `Task \`docs-mcp-onboarding\`. Goal: onboard onto Pharos using **only the Developer Docs MCP**, and log where it breaks down.`,
  );
  out.push("");
  out.push(
    `- **Server:** \`${session.endpoint}\` (${session.server.title}, v${session.server.version}, MCP protocol ${session.protocolVersion})`,
  );
  const used = [...new Set(session.steps.flatMap((s) => s.calls.map((c) => c.tool)))];
  out.push(`- **Tools used:** ${used.map((t) => `\`${t}\``).join(", ")} (the server also exposes ${session.tools.filter((t) => !used.includes(t.name)).map((t) => `\`${t.name}\``).join(", ") || "nothing else"}, which this session did not call)`);
  out.push(`- **Run:** ${session.startedAt} → ${session.finishedAt}, by \`scripts/mcp-session.mjs\``);
  out.push(`- **Source of truth:** the Docs MCP only. No page was fetched any other way in this log.`);
  out.push("");
  out.push(
    "Every call below shows the exact tool and arguments, and the answer is quoted verbatim. Verdicts follow a stated rule applied to that quoted answer. `data/mcp-session.json` holds the raw responses; `npm run mcp:render` rebuilds this file from it.",
  );
  out.push("");
  out.push("## Result");
  out.push("");
  out.push(`${rows.length} steps · ${resolved.length} answered · **${gaps.length} gaps** · ${errors.length} errors`);
  out.push("");
  out.push("| # | Step | Verdict | Severity |");
  out.push("| --- | --- | --- | --- |");
  for (const r of rows) out.push(`| ${r.n} | ${r.step.title} | ${r.v.status} | ${r.v.status === "GAP" ? r.step.severity || "—" : "—"} |`);
  out.push("");

  out.push("## Step-by-step log");
  for (const r of rows) {
    out.push("");
    out.push(`### Step ${r.n} — ${r.step.title}`);
    out.push("");
    out.push(`**Trying to:** ${r.step.goal}`);
    for (const c of r.rec.calls) {
      out.push("");
      out.push(`**Query** — \`${c.tool}\` · ${(c.ms / 1000).toFixed(1)} s`);
      out.push("");
      out.push(fence(JSON.stringify(c.args)));
      out.push("");
      if (!c.ok) {
        out.push(`**Call failed:** \`${c.error}\``);
        continue;
      }
      const { main, sources } = splitSources(c.answer);
      const MAX = 1800;
      const shown = main.length > MAX ? `${main.slice(0, MAX).trimEnd()}\n\n[… ${main.length - MAX} more characters in data/mcp-session.json]` : main;
      out.push("**Answer**");
      out.push("");
      out.push(quote(shown));
      if (sources) {
        const n = (sources.match(/^- /gm) || []).length;
        out.push("");
        out.push(`<details><summary>${n} cited sources</summary>\n\n${sources.trim()}\n\n</details>`);
      }
    }
    out.push("");
    out.push(`**Verdict: ${r.v.status}${r.v.status === "GAP" && r.step.severity ? ` (${r.step.severity})` : ""}.** ${r.v.rule}`);
  }

  out.push("");
  out.push("## Gaps and suggested fixes");
  if (!gaps.length) out.push("\nNo gaps surfaced.");
  gaps.forEach((r, i) => {
    out.push("");
    out.push(`### Gap ${i + 1} — [${r.step.severity}] ${r.step.title}`);
    out.push("");
    out.push(`**Exact query:** ${r.rec.calls.map((c) => `\`${c.tool}\` ${"`" + JSON.stringify(c.args) + "`"}`).join(" · ")}`);
    out.push("");
    out.push(`**What broke:** ${r.v.rule}`);
    out.push("");
    out.push(`**What the docs should say:** ${r.step.fix}`);
  });

  const allCalls = session.steps.flatMap((s) => s.calls);
  const failedCalls = allCalls.filter((c) => !c.ok).length;
  const totalSeconds = allCalls.reduce((n, c) => n + c.ms, 0) / 1000;
  const stoppers = rows.filter((r) => r.v.status === "GAP" && (r.step.severity === "CRITICAL" || r.step.severity === "HIGH"));
  out.push("");
  out.push("## What I managed to build or run by the end");
  out.push("");
  out.push("**Ran:**");
  out.push("");
  out.push(
    `- ${allCalls.length} Docs MCP calls (${used.map((t) => `\`${t}\``).join(", ")}), ${failedCalls} failed, ${totalSeconds.toFixed(0)} s of server time. Raw responses are in \`data/mcp-session.json\`.`,
  );
  for (const r of resolved) out.push(`- Resolved from the docs alone: **${r.step.title}** — ${r.v.rule}`);
  out.push("");
  out.push("**Did not get to:**");
  out.push("");
  out.push(
    "- No contract was deployed and no transaction was sent from this session. The session only queries the Docs MCP; it holds no wallet.",
  );
  if (stoppers.length) {
    out.push(
      `- A first-time developer following these answers would be stopped, or sent to guess, at: ${stoppers.map((r) => `step ${r.n} (${r.step.title}, ${r.step.severity})`).join("; ")}.`,
    );
  }
  out.push("");
  out.push("**Built:**");
  out.push("");
  out.push(
    "- `scripts/mcp-session.mjs` — replays this journey against the Docs MCP, derives each verdict from the recorded answer by a stated rule, and renders this log. `npm run mcp:check` fails if this file is not exactly what the raw session renders to.",
  );
  out.push(
    "- A cross-check outside the MCP, kept separate from this log: `npm run audit:live` recounts the same journey over a pinned `docs.pharos.xyz` snapshot and probes the chain, TLS certificates and the chain MCP directly. The certificate evidence mentioned in Gaps 1 and 2 comes from that audit, not from the Docs MCP. See `reports/audit.md`.",
  );
  return out.join("\n") + "\n";
}

export function buildArtifact(session, markdown) {
  const rows = STEPS.map((step, i) => {
    const rec = session.steps.find((s) => s.id === step.id);
    const failed = rec.calls.filter((c) => !c.ok);
    const s = { calls: rec.calls.map((c) => ({ ...c, answer: c.answer || "" })) };
    const v = failed.length
      ? { status: "ERROR", rule: `${failed.length} call(s) failed: ${failed.map((f) => f.error).join("; ")}` }
      : step.judge(s);
    const calls = rec.calls.map((c) => {
      if (!c.ok) return { tool: c.tool, args: c.args, ok: false, ms: c.ms, error: c.error };
      const { main, sources } = splitSources(c.answer || "");
      const MAX = 1800;
      const shown =
        main.length > MAX
          ? `${main.slice(0, MAX).trimEnd()}\n\n[… ${main.length - MAX} more characters in data/mcp-session.json]`
          : main.trim();
      const sourceCount = sources ? (sources.match(/^- /gm) || []).length : 0;
      return { tool: c.tool, args: c.args, ok: true, ms: c.ms, excerpt: shown, sourceCount };
    });
    return {
      n: i + 1,
      id: step.id,
      title: step.title,
      goal: step.goal,
      severity: step.severity,
      status: v.status,
      rule: v.rule,
      fix: step.fix,
      calls,
    };
  });

  const allCalls = session.steps.flatMap((s) => s.calls);
  const used = [...new Set(allCalls.map((c) => c.tool))];
  const failedCalls = allCalls.filter((c) => !c.ok).length;
  const totalSeconds = Math.round(allCalls.reduce((n, c) => n + c.ms, 0) / 1000);
  const gaps = rows.filter((r) => r.status === "GAP");
  const resolved = rows.filter((r) => r.status === "RESOLVED");
  const errors = rows.filter((r) => r.status === "ERROR");
  const stoppers = rows.filter((r) => r.status === "GAP" && (r.severity === "CRITICAL" || r.severity === "HIGH"));

  return {
    endpoint: session.endpoint,
    server: session.server,
    protocolVersion: session.protocolVersion,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    toolsUsed: used,
    toolsUnused: session.tools.filter((t) => !used.includes(t.name)).map((t) => t.name),
    summary: {
      totalSteps: rows.length,
      resolved: resolved.length,
      gaps: gaps.length,
      errors: errors.length,
      totalCalls: allCalls.length,
      failedCalls,
      totalSeconds,
    },
    steps: rows,
    outcome: {
      ran: [
        `${allCalls.length} Docs MCP calls (${used.join(", ")}), ${failedCalls} failed, ${totalSeconds} s of server time. Raw responses are in data/mcp-session.json.`,
        ...resolved.map((r) => `Resolved from the docs alone: ${r.title} — ${r.rule}`),
      ],
      didNotGetTo: [
        "No contract was deployed and no transaction was sent from this session. The session only queries the Docs MCP; it holds no wallet.",
        ...(stoppers.length
          ? [
              `A first-time developer following these answers would be stopped, or sent to guess, at: ${stoppers.map((r) => `step ${r.n} (${r.title}, ${r.severity})`).join("; ")}.`,
            ]
          : []),
      ],
      built: [
        "scripts/mcp-session.mjs — replays this journey against the Docs MCP, derives each verdict from the recorded answer by a stated rule, and renders this log. npm run mcp:check fails if this file is not exactly what the raw session renders to.",
        "A cross-check outside the MCP, kept separate from this log: npm run audit:live recounts the same journey over a pinned docs.pharos.xyz snapshot and probes the chain, TLS certificates and the chain MCP directly. The certificate evidence mentioned in Gaps 1 and 2 comes from that audit, not from the Docs MCP. See reports/audit.md.",
      ],
    },
    markdown,
  };
}

function formatArtifactJs(artifact) {
  return (
    "// GENERATED — produced by scripts/mcp-session.mjs. Do not edit.\n" +
    `export const MCP_SESSION = ${JSON.stringify(artifact)};\n`
  );
}

// --------------------------------------------------------------------- main
const renderOnly = process.argv.includes("--render") || process.argv.includes("--check");
const checkOnly = process.argv.includes("--check");
let session;
if (renderOnly) {
  if (!existsSync(RAW)) {
    process.stderr.write(`${RAW} not found. Run without --render first.\n`);
    process.exit(1);
  }
  session = JSON.parse(readFileSync(RAW, "utf8"));
} else {
  session = await run();
}
const md = render(session);
const js = formatArtifactJs(buildArtifact(session, md));
if (checkOnly) {
  const sameMd = existsSync(LOG) && readFileSync(LOG, "utf8") === md;
  const sameJs = existsSync(ARTIFACT) && readFileSync(ARTIFACT, "utf8") === js;
  const same = sameMd && sameJs;
  const failed = session.steps.flatMap((s) => s.calls).filter((c) => !c.ok).length;
  const calls = session.steps.reduce((n, s) => n + s.calls.length, 0);
  process.stdout.write(`${same ? "ok" : "FAIL"}  docs/mcp-session-log.md + public/mcp-session.generated.js ${same ? "match" : "differ from"} data/mcp-session.json (${calls} calls, ${failed} failed)\n`);
  process.exit(same && !failed ? 0 : 1);
}
mkdirSync(dirname(LOG), { recursive: true });
mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(LOG, md);
writeFileSync(ARTIFACT, js);
process.stdout.write(`wrote ${LOG} and ${ARTIFACT}\n`);
const errored = session.steps.flatMap((s) => s.calls).filter((c) => !c.ok);
if (errored.length) {
  process.stderr.write(`${errored.length} call(s) failed; the log says so, but re-run before publishing.\n`);
  process.exit(2);
}
