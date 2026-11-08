#!/usr/bin/env node
// Run the onboarding audit and write every artifact from one pass.
//
//   node scripts/audit.mjs            # offline: corpus only, live steps UNVERIFIED
//   node scripts/audit.mjs --live     # also hit the chain and the MCP server
//
// Outputs:
//   reports/audit.json          full snapshot, machine readable
//   reports/audit.md            the DevRel report
//   public/audit.generated.js   the same snapshot for the dashboard
//
// The dashboard is not allowed to compute its own answer, so it consumes the
// artifact this script writes. One pass, one truth.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildAudit } from "../src/audit.mjs";
import { collectLiveSnapshot } from "../src/live.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.argv.includes("--live");

/** Pull the documented MCP tool names out of the corpus instead of hardcoding
 *  them. If the page changes, the comparison changes with it. */
export function extractDocumentedTools(pages) {
  const page = pages.find((p) => p.id === "tooling-and-infrastructure/mcp");
  if (!page) return [];
  const names = page.plain.match(/\b(?:get|send|eth|estimate)_[a-z0-9_]+\b/g) || [];
  return [...new Set(names)].sort();
}

async function main() {
  const corpusPath = path.join(ROOT, "data", "corpus.json");
  let corpus;
  try {
    corpus = JSON.parse(await readFile(corpusPath, "utf8"));
  } catch {
    console.error(`no corpus at ${corpusPath} — run: npm run build:index`);
    process.exit(1);
  }

  const documentedTools = extractDocumentedTools(corpus.pages);
  process.stdout.write(`corpus: ${corpus.meta.pageCount} pages, hash ${corpus.meta.contentHash.slice(0, 16)}\n`);
  process.stdout.write(`documented MCP tools: ${documentedTools.length}\n`);

  let live = null;
  if (LIVE) {
    process.stdout.write("collecting live snapshot (chain + MCP)…\n");
    try {
      live = await collectLiveSnapshot({ documentedTools });
      const p = live.pacific;
      const a = live.atlantic;
      process.stdout.write(
        `  pacific  ${p.ok ? `chainId ${p.chainId}` : `FAILED ${p.error}`}\n` +
          `  atlantic ${a.ok ? `chainId ${a.chainId}` : `FAILED ${a.error}`}\n` +
          `  testnet hosts ok=${live.atlanticTls.ok} cert=${(live.atlanticTls.certNames || []).join(",") || "n/a"}\n` +
          `  mcp      ${live.mcp.ok ? `${live.mcp.toolCount} tools, health chainId ${live.mcp.healthChainId}` : `FAILED ${live.mcp.error}`}\n`,
      );
    } catch (err) {
      console.error(`live snapshot failed: ${err.message}`);
      console.error("Refusing to write a report that silently omits the live checks — rerun without --live for an offline audit.");
      process.exit(1);
    }
  } else {
    process.stdout.write("offline mode: live-dependent checks will be reported UNVERIFIED\n");
  }

  const audit = buildAudit({ corpus, live, generatedAt: live?.fetchedAt || null });

  await mkdir(path.join(ROOT, "reports"), { recursive: true });
  await writeFile(path.join(ROOT, "reports", "audit.json"), JSON.stringify(audit, null, 2) + "\n");
  await writeFile(path.join(ROOT, "reports", "audit.md"), audit.markdown);

  // Dashboard artifact. The markdown is dropped (the UI renders from the
  // structured fields) and so is the per-result raw `live` blob, which is large
  // and duplicated in the summary.
  const slim = {
    ...audit,
    markdown: undefined,
    results: audit.results.map(({ live: _l, ...rest }) => rest),
    liveChecks: loadableLiveSummary(live),
  };
  // The markdown is a separate artifact. The dashboard downloads it, so sending
  // it inside the JSON snapshot as well would ship the same ~12 KB twice.
  await writeFile(
    path.join(ROOT, "public", "report.generated.js"),
    "// GENERATED — produced by scripts/audit.mjs. Do not edit.\n" +
      `export const REPORT_MD = ${JSON.stringify(audit.markdown)};\n`,
  );

  await writeFile(
    path.join(ROOT, "public", "audit.generated.js"),
    "// GENERATED — produced by scripts/audit.mjs. Do not edit.\n" +
      `export const AUDIT = ${JSON.stringify(slim)};\n`,
  );

  const s = audit.summary;
  process.stdout.write(
    `\n${s.totalChecks} checks · ${s.resolved} resolved · ${s.gaps} gaps · ${s.unverified} unverified\n` +
      `severity: ${Object.entries(s.severityCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}\n` +
      `resolution rate: ${s.resolutionRate}%\n\n` +
      `wrote reports/audit.json, reports/audit.md, public/audit.generated.js, public/report.generated.js\n`,
  );

  for (const g of audit.results.filter((r) => r.status === "GAP")) {
    process.stdout.write(`  [${g.severity}] ${g.title}\n`);
  }
}

function loadableLiveSummary(live) {
  if (!live) return null;
  return {
    fetchedAt: live.fetchedAt,
    pacific: { ok: live.pacific.ok, chainId: live.pacific.chainId ?? null, error: live.pacific.error ?? null },
    atlantic: { ok: live.atlantic.ok, chainId: live.atlantic.chainId ?? null, error: live.atlantic.error ?? null },
    testnet: {
      ok: live.atlanticTls.ok,
      failing: live.atlanticTls.failing,
      certNames: live.atlanticTls.certNames,
      hosts: live.atlanticTls.all.map((h) => ({ host: h.host, ok: h.ok, chainId: h.chainId ?? null, error: h.error ?? null })),
    },
    mcp: {
      ok: live.mcp.ok,
      toolCount: live.mcp.toolCount ?? null,
      healthChainId: live.mcp.healthChainId ?? null,
      missing: live.mcp.ok
        ? live.mcp.documented.filter((t) => !live.mcp.actual.includes(t))
        : null,
      undocumented: live.mcp.ok
        ? live.mcp.actual.filter((t) => !live.mcp.documented.includes(t))
        : null,
    },
  };
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
