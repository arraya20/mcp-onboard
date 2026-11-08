// Aggregate probe results into the report shape both the API and the dashboard
// render. Browser-safe: the dashboard recomputes this from the same inputs.

import { runProbes, SEVERITY_RUBRIC, STEP_ORDER } from "./probes.mjs";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** How many sources a gap prints. Enough to show the contradiction and the
 *  pages around it; the JSON snapshot always carries the full list. */
const EVIDENCE_SHOWN = 6;

/**
 * One audit snapshot.
 *
 * `status` per step is deliberately four-valued. A binary pass/fail forces the
 * dishonest move of calling an unchecked step "passed" (the usual failure mode
 * of audit tools) or "failed" (which invents a gap). UNVERIFIED means exactly
 * what it says and is never counted as resolved.
 */
export function buildAudit({ corpus, live = null, generatedAt = null }) {
  const results = runProbes(corpus.pages, live);
  const total = results.length;
  const passed = results.filter((r) => r.status === "RESOLVED").length;
  const gaps = results.filter((r) => r.status === "GAP");
  const unverified = results.filter((r) => r.status === "UNVERIFIED");
  const partial = results.filter((r) => r.status === "PARTIAL");
  const errored = results.filter((r) => r.status === "ERROR");

  const severityCounts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const g of gaps) severityCounts[g.severity] = (severityCounts[g.severity] || 0) + 1;

  const byStep = Object.fromEntries(
    STEP_ORDER.map((step) => {
      const items = results.filter((r) => r.step === step);
      const g = items.filter((r) => r.status === "GAP").length;
      const p = items.filter((r) => r.status === "RESOLVED").length;
      const u = items.filter((r) => r.status === "UNVERIFIED").length;
      return [step, { total: items.length, gaps: g, resolved: p, unverified: u }];
    }),
  );

  const audit = {
    schemaVersion: 1,
    generatedAt,
    corpus: {
      source: corpus.meta.source,
      indexUrl: corpus.meta.indexUrl,
      pageCount: corpus.meta.pageCount,
      contentHash: corpus.meta.contentHash,
    },
    live: live
      ? { fetchedAt: live.fetchedAt, source: live.source }
      : null,
    summary: {
      totalChecks: total,
      resolved: passed,
      gaps: gaps.length,
      unverified: unverified.length,
      partial: partial.length,
      errors: errored.length,
      resolutionRate: total ? Math.round((passed / total) * 1000) / 10 : 0,
      severityCounts,
      // Honest denominator: gaps measured against the checks we could evaluate.
      evaluated: total - unverified.length - errored.length,
    },
    byStep,
    results,
    severityRubric: SEVERITY_RUBRIC,
  };

  audit.markdown = renderMarkdown(audit);
  return audit;
}

/** For a gap, the headline has to be the broken state. The probe's `title` is
 *  the claim being tested, so printing it unchanged next to "GAP" reads like a
 *  pass on a skim. */
function headline(r) {
  return r.status === "GAP" && r.gapTitle ? r.gapTitle : r.title;
}

const LABEL = {
  RESOLVED: "RESOLVED",
  GAP: "GAP",
  UNVERIFIED: "UNVERIFIED",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
};

function renderMarkdown(a) {
  const s = a.summary;
  const lines = [];
  lines.push("# Pharos documentation — first-time developer gap audit");
  lines.push("");
  lines.push(
    `Task \`docs-mcp-onboarding\`. No documentation MCP server exists for Pharos: \`mcp.pharos.xyz\` is a chain JSON-RPC server. The audit therefore runs against the documentation corpus itself — **${a.corpus.pageCount} pages** of \`${a.corpus.source}\` (corpus hash \`${a.corpus.contentHash.slice(0, 16)}\`).`,
  );
  if (a.live) {
    lines.push(
      `Live checks were run against the chain and the MCP server at ${a.live.fetchedAt}.`,
    );
  } else {
    lines.push(
      "**No live snapshot was included.** Steps that need the network to answer are marked UNVERIFIED, not passed.",
    );
  }
  lines.push("");
  lines.push(
    "All counts below are literal, case-insensitive substring occurrences over the pinned corpus — the same rule the search box uses, so every number here can be reproduced by typing the query. No stemming, no synonyms, no fuzzy matching.",
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Onboarding checks | ${s.totalChecks} |`);
  lines.push(`| Resolved by the docs | ${s.resolved} |`);
  lines.push(`| Gaps | ${s.gaps} |`);
  lines.push(`| Unverified (no live proof) | ${s.unverified} |`);
  lines.push(`| Resolution rate | ${s.resolutionRate}% of ${s.totalChecks} checks |`);
  lines.push(
    `| Gaps by severity | ${SEVERITY_ORDER.map((k) => `${k} ${s.severityCounts[k]}`).join(" · ")} |`,
  );
  lines.push("");
  lines.push(
    s.unverified
      ? `Resolution rate counts only checks the docs actually answered. ${s.unverified} check${s.unverified === 1 ? "" : "s"} could not be verified and ${s.unverified === 1 ? "is" : "are"} excluded from the numerator rather than assumed good.`
      : "Resolution rate counts only checks the docs actually answered. Every check below produced a verdict from evidence.",
  );
  lines.push("");

  lines.push("## Journey");
  lines.push("");
  lines.push("| # | Step | Status | Severity |");
  lines.push("| --- | --- | --- | --- |");
  a.results.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${headline(r)} | ${LABEL[r.status]} | ${r.status === "GAP" ? r.severity : "—"} |`,
    );
  });
  lines.push("");

  const gaps = a.results.filter((r) => r.status === "GAP");
  lines.push(`## Gaps (${gaps.length})`);
  lines.push("");
  if (!gaps.length) {
    lines.push("No gaps found. Either the docs are complete or the probes are too generous.");
    lines.push("");
  }
  for (const g of gaps) {
    lines.push(`### [${g.severity}] ${headline(g)}`);
    lines.push("");
    lines.push(`**Developer question.** ${g.question}`);
    lines.push("");
    lines.push(`**Finding.** ${g.finding}`);
    lines.push("");
    if (g.evidence?.length) {
      lines.push("**Evidence.**");
      lines.push("");
      if (g.evidence.length > EVIDENCE_SHOWN) {
        lines.push(`_Showing ${EVIDENCE_SHOWN} of ${g.evidence.length} citing sources._`);
        lines.push("");
      }
      for (const e of g.evidence.slice(0, EVIDENCE_SHOWN)) {
        const note = e.note ? ` _(${e.note})_` : "";
        lines.push(`- \`${e.id}\`${note} — ${e.url}`);
        lines.push(`  > ${String(e.snippet).replace(/\s+/g, " ").trim().slice(0, 300)}`);
      }
      lines.push("");
    }
    if (g.query) {
      lines.push(`**Reproduce.** Search the corpus for \`${g.query}\` — via the box on the dashboard, or run \`node scripts/verify-claims.mjs\` to recount every number in this report.`);
      lines.push("");
    }
    lines.push(`**Recommendation.** ${g.recommendation}`);
    lines.push("");
  }

  const resolved = a.results.filter((r) => r.status === "RESOLVED");
  if (resolved.length) {
    lines.push(`## Checks the docs answer (${resolved.length})`);
    lines.push("");
    for (const r of resolved) {
      lines.push(`**RESOLVED** — ${r.title}`);
      lines.push("");
      lines.push(`> ${r.finding}`);
      lines.push("");
    }
  }

  // Anything that is neither a gap nor a pass belongs here. These are not
  // findings, and folding them into "not gaps" would quietly read as passes.
  const other = a.results.filter((r) => [ "UNVERIFIED", "PARTIAL", "ERROR" ].includes(r.status));
  if (other.length) {
    lines.push(`## Not evaluated (${other.length})`);
    lines.push("");
    lines.push("These checks produced no usable answer. They are excluded from the resolution rate, not counted as passes.");
    lines.push("");
    for (const r of other) {
      lines.push(`**${LABEL[r.status]}** — ${r.title}`);
      lines.push("");
      lines.push(`> ${r.finding}`);
      lines.push("");
    }
  }

  lines.push("## Severity rubric");
  lines.push("");
  for (const [k, v] of Object.entries(a.severityRubric)) {
    lines.push(`- **${k}** — ${v}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Every finding above is reproducible: the corpus hash pins the documentation snapshot, and each gap names the query that surfaced it. Regenerate with `npm run audit`.",
  );
  lines.push("");
  return lines.join("\n");
}
