// Aggregate probe results into the report shape both the API and the dashboard
// render. Browser-safe: the dashboard recomputes this from the same inputs.

import { runProbes, SEVERITY_RUBRIC, STEP_ORDER } from "./probes.mjs";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

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
  lines.push("# Pharos Docs MCP — Self-Onboarding Gap Audit");
  lines.push("");
  lines.push(
    `Audited **${a.corpus.pageCount} pages** of \`${a.corpus.source}\` (corpus hash \`${a.corpus.contentHash.slice(0, 16)}\`).`,
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
    `Resolution rate counts only checks the docs actually answered. ${s.unverified} check(s) could not be verified and are excluded from the numerator rather than assumed good.`,
  );
  lines.push("");

  lines.push("## Journey");
  lines.push("");
  lines.push("| # | Step | Status | Severity |");
  lines.push("| --- | --- | --- | --- |");
  a.results.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.title} | ${LABEL[r.status]} | ${r.status === "GAP" ? r.severity : "—"} |`,
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
    lines.push(`### [${g.severity}] ${g.title}`);
    lines.push("");
    lines.push(`**Developer question.** ${g.question}`);
    lines.push("");
    lines.push(`**Finding.** ${g.finding}`);
    lines.push("");
    if (g.evidence?.length) {
      lines.push("**Evidence.**");
      lines.push("");
      for (const e of g.evidence.slice(0, 4)) {
        const note = e.note ? ` _(${e.note})_` : "";
        lines.push(`- \`${e.id}\`${note} — ${e.url}`);
        lines.push(`  > ${String(e.snippet).replace(/\s+/g, " ").trim().slice(0, 300)}`);
      }
      lines.push("");
    }
    if (g.query) {
      lines.push(`**Reproduce.** Search the corpus for \`${g.query}\`.`);
      lines.push("");
    }
    lines.push(`**Recommendation.** ${g.recommendation}`);
    lines.push("");
  }

  const rest = a.results.filter((r) => r.status !== "GAP");
  if (rest.length) {
    lines.push(`## Not gaps (${rest.length})`);
    lines.push("");
    for (const r of rest) {
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
