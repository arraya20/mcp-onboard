// Dashboard. Renders the audit artifact produced by `npm run audit` and offers
// a corpus search that goes through the same handler a stranger would call.
//
// Hard rule: this file computes no verdicts and invents no numbers. If the
// artifact is missing, or the search endpoint fails, the page says so and shows
// nothing — it never falls back to a plausible-looking default. The version of
// this page that shipped with the scaffold had six hardcoded journey rows with
// confident prose about "MCP answers" that no server ever produced; that is the
// specific bug this design exists to prevent.

import { AUDIT } from "./audit.generated.js";
import { MCP_SESSION } from "./mcp-session.generated.js";

const $ = (id) => document.getElementById(id);

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
};

// Everything below builds DOM nodes and sets textContent. There is deliberately
// no innerHTML path in this file: snippets and titles come from a fetched corpus,
// and one of them will eventually contain angle brackets.

// ---------------------------------------------------------------- integrity

function assertUsable(audit) {
  if (!audit || typeof audit !== "object") throw new Error("audit artifact is empty");
  if (!Array.isArray(audit.results) || !audit.results.length) throw new Error("audit artifact has no results");
  if (!audit.corpus?.contentHash) throw new Error("audit artifact is missing a corpus hash");
  const s = audit.summary;
  if (!s || typeof s.gaps !== "number") throw new Error("audit artifact has no summary");
  return audit;
}

// ------------------------------------------------------------------ render

function renderHeader(a) {
  $("corpusHash").textContent = a.corpus.contentHash.slice(0, 16);
  $("corpusMeta").textContent = `${a.corpus.pageCount} pages`;
  $("footerLeft").textContent = a.live
    ? `live checks at ${a.live.fetchedAt}`
    : "offline snapshot — live checks not run";
}

function renderSummary(a) {
  const s = a.summary;
  const crit = s.severityCounts?.CRITICAL ?? 0;
  const rows = [
    ["Checks", String(s.totalChecks), `${s.evaluated} evaluated`, ""],
    ["Gaps", String(s.gaps), crit ? `${crit} critical` : "none critical", s.gaps ? "crit" : "ok"],
    ["Resolved", String(s.resolved), "documentation answered it", "ok"],
    ["Resolution", `${s.resolutionRate}%`, `of ${s.totalChecks} checks`, ""],
  ];
  const dl = $("summary");
  dl.replaceChildren(
    ...rows.flatMap(([label, value, foot, cls]) => [
      el("div", { class: "stat" }, [
        el("dt", { text: label }),
        el("dd", { class: cls, text: value }),
        el("div", { class: "footnote", text: foot }),
      ]),
    ]),
  );

  const unverified = s.unverified ?? 0;
  const parts = [`${s.gaps} of ${s.totalChecks} steps fail as written.`];
  if (unverified) {
    parts.push(
      `${unverified} step(s) could not be verified without the network and are counted as unresolved, not as passing.`,
    );
  }
  if (s.errors) parts.push(`${s.errors} probe(s) errored and are excluded from the rate.`);
  $("disclaimer").replaceChildren(
    el("span", {}, [el("strong", { text: parts[0] }), " " + parts.slice(1).join(" ")]),
  );
}

function statusChip(r) {
  if (r.status === "GAP") {
    const cls = r.severity === "CRITICAL" ? "chip chip-critical" : "chip chip-gap";
    return el("span", { class: cls, text: r.severity });
  }
  if (r.status === "RESOLVED") return el("span", { class: "chip chip-resolved", text: "RESOLVED" });
  return el("span", { class: "chip chip-unverified", text: r.status });
}

function evidenceList(r) {
  if (!r.evidence?.length) return null;
  return el(
    "ul",
    { class: "evidence" },
    r.evidence.slice(0, 6).map((e) =>
      el("li", {}, [
        el("a", { href: e.url, target: "_blank", rel: "noopener", text: e.id }),
        e.note ? el("span", { class: "note", text: `(${e.note})` }) : null,
        el("blockquote", { text: String(e.snippet).replace(/\s+/g, " ").trim().slice(0, 340) }),
      ]),
    ),
  );
}

/** The probe's `title` is the claim under test. Printed beside a GAP chip it
 *  reads like a pass, so a gap renders its gapTitle instead. */
function headline(r) {
  return r.status === "GAP" && r.gapTitle ? r.gapTitle : r.title;
}

function gapDetail(r) {
  return el("article", { class: "detail", id: `gap-${r.id}` }, [
    el("h3", { text: headline(r) }),
    el("div", {
      class: "meta",
      text: `${r.severity} · ${r.category} · check ${r.id}`,
    }),
    el("dl", { class: "field" }, [
      el("dt", { text: "Developer question" }),
      el("dd", { text: r.question }),
    ]),
    el("dl", { class: "field" }, [
      el("dt", { text: "Finding" }),
      el("dd", { text: r.finding }),
    ]),
    r.evidence?.length
      ? el("dl", { class: "field" }, [el("dt", { text: "Evidence" }), el("dd", {}, [evidenceList(r)])])
      : null,
    r.query
      ? el("dl", { class: "field" }, [
          el("dt", { text: "Reproduce" }),
          el("dd", {}, [el("code", { class: "result-id", text: `search("${r.query}")` })]),
        ])
      : null,
    el("dl", { class: "field" }, [
      el("dt", { text: "Recommendation" }),
      el("dd", { class: "rec", text: r.recommendation }),
    ]),
  ]);
}

function renderGaps(a) {
  const gaps = a.results.filter((r) => r.status === "GAP");
  const resolved = a.results.filter((r) => r.status === "RESOLVED");
  const other = a.results.filter((r) => r.status !== "GAP" && r.status !== "RESOLVED");
  $("countGaps").textContent = String(gaps.length);
  $("countJourney").textContent = String(a.results.length);

  const body = $("gapsBody");
  if (!gaps.length) {
    body.replaceChildren(
      el("p", {
        class: "empty",
        text: "No gaps recorded in this snapshot. Either the docs cover all eight steps or the probes are too generous — the probes are in src/probes.mjs and are readable.",
      }),
    );
  } else {
    body.replaceChildren(...gaps.map(gapDetail));
  }

  // Two groups, not one. Folding UNVERIFIED/ERROR into "not gaps" reads as a pass,
  // which is the exact mistake the five-valued status exists to prevent.
  for (const [heading, items] of [
    [`Checks the docs answer (${resolved.length})`, resolved],
    [`Not evaluated (${other.length})`, other],
  ]) {
    if (!items.length) continue;
    body.append(
      el("div", { class: "rubric" }, [
        el("h2", { text: heading }),
        el(
          "div",
          {},
          items.map((r) =>
            el("div", { class: "result" }, [
              el("div", { class: "result-head" }, [
                el("span", { text: headline(r) }),
                statusChip(r),
              ]),
              el("blockquote", { text: r.finding }),
            ]),
          ),
        ),
      ]),
    );
  }
}

function renderJourney(a) {
  const rows = a.results.map((r, i) => {
    const tr = el("tr", { class: "row", tabindex: "0", role: "link" }, [
      el("td", { text: String(i + 1).padStart(2, "0") }),
      el("td", {}, [el("span", { class: "title", text: headline(r) }), el("span", { class: "question", text: r.question })]),
      el("td", {}, [el("span", { class: "step-name", text: r.category })]),
      el("td", {}, [statusChip(r)]),
    ]);
    const go = () => {
      switchTab("gaps");
      const target = document.getElementById(`gap-${r.id}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    tr.addEventListener("click", go);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
    return tr;
  });

  $("journeyBody").replaceChildren(
    el("table", { class: "journey" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "#" }),
          el("th", { text: "Step" }),
          el("th", { text: "Stage" }),
          el("th", { text: "Verdict" }),
        ]),
      ]),
      el("tbody", {}, rows),
    ]),
  );
}

function renderRubric(a) {
  $("rubricList").replaceChildren(
    ...Object.entries(a.severityRubric || {}).flatMap(([k, v]) => [
      el("dt", { text: k }),
      el("dd", { text: v }),
    ]),
  );
}

function renderMcpSession(mcp) {
  const body = $("mcpBody");
  if (!mcp || !Array.isArray(mcp.steps) || !mcp.steps.length) {
    body.replaceChildren(
      el("div", { class: "notice notice-error" }, [
        el("strong", { text: "No Docs MCP session artifact. " }),
        "Run `npm run mcp:render` and reload.",
      ]),
    );
    return;
  }

  $("countMcp").textContent = String(mcp.steps.length);
  const sum = mcp.summary || {};

  const metaBox = el("div", { class: "notice notice-info" }, [
    el("strong", {
      text: `${sum.totalSteps} steps · ${sum.resolved} answered · ${sum.gaps} gaps · ${sum.totalCalls} Docs MCP calls (${sum.failedCalls} failed, ${sum.totalSeconds}s). `,
    }),
    `Server: ${mcp.endpoint} (${mcp.server?.title || "Docs MCP"} v${mcp.server?.version || "?"}, protocol ${mcp.protocolVersion}). Tools used: ${(mcp.toolsUsed || []).join(", ")}.`,
  ]);

  const stepCards = mcp.steps.map((s) => {
    const callItems = (s.calls || []).map((c) =>
      el("li", {}, [
        el("div", { class: "mcp-call-head" }, [
          el("code", { class: "result-id", text: `${c.tool} ${JSON.stringify(c.args)}` }),
          el("span", { class: "note", text: `${(c.ms / 1000).toFixed(1)}s${c.sourceCount ? ` · ${c.sourceCount} cited sources` : ""}` }),
        ]),
        c.ok
          ? el("blockquote", { text: c.excerpt })
          : el("blockquote", { text: `Call failed: ${c.error}` }),
      ]),
    );

    return el("article", { class: "detail", id: `mcp-step-${s.id}` }, [
      el("div", { class: "result-head" }, [
        el("h3", { text: `Step ${s.n} — ${s.title}` }),
        statusChip(s),
      ]),
      el("div", { class: "meta", text: `Docs MCP session · ${s.calls.length} call${s.calls.length === 1 ? "" : "s"}` }),
      el("dl", { class: "field" }, [
        el("dt", { text: "Trying to" }),
        el("dd", { text: s.goal }),
      ]),
      el("dl", { class: "field" }, [
        el("dt", { text: "Queries & verbatim Docs MCP responses" }),
        el("dd", {}, [el("ul", { class: "evidence" }, callItems)]),
      ]),
      el("dl", { class: "field" }, [
        el("dt", { text: s.status === "GAP" ? "What broke" : "Verdict" }),
        el("dd", { text: s.rule }),
      ]),
      s.fix
        ? el("dl", { class: "field" }, [
            el("dt", { text: "What the docs should say (suggested fix)" }),
            el("dd", { class: "rec", text: s.fix }),
          ])
        : null,
    ]);
  });

  const outcome = mcp.outcome || {};
  const outcomeSection = el("article", { class: "detail" }, [
    el("h3", { text: "What I managed to build or run by the end" }),
    el("div", { class: "meta", text: "Task deliverable · end-of-session summary" }),
    el("dl", { class: "field" }, [
      el("dt", { text: "Ran" }),
      el("dd", {}, [
        el("ul", { class: "mcp-list" }, (outcome.ran || []).map((item) => el("li", { text: item }))),
      ]),
    ]),
    el("dl", { class: "field" }, [
      el("dt", { text: "Did not get to" }),
      el("dd", {}, [
        el("ul", { class: "mcp-list" }, (outcome.didNotGetTo || []).map((item) => el("li", { text: item }))),
      ]),
    ]),
    el("dl", { class: "field" }, [
      el("dt", { text: "Built" }),
      el("dd", {}, [
        el("ul", { class: "mcp-list" }, (outcome.built || []).map((item) => el("li", { text: item }))),
      ]),
    ]),
  ]);

  body.replaceChildren(metaBox, ...stepCards, outcomeSection);
}

// -------------------------------------------------------------------- tabs

const TAB_KEYS = ["gaps", "mcp", "journey", "search"];

function switchTab(name) {
  for (const key of TAB_KEYS) {
    const tab = $(`tab-${key}`);
    const panel = $(`panel-${key}`);
    const on = key === name;
    tab.setAttribute("aria-selected", String(on));
    panel.hidden = !on;
  }
}

for (const key of TAB_KEYS) {
  $(`tab-${key}`).addEventListener("click", () => switchTab(key));
}

// ------------------------------------------------------------------ search

let searchSeq = 0;

async function runSearch(query) {
  const body = $("searchBody");
  const seq = ++searchSeq;

  body.replaceChildren(el("p", { class: "empty", text: "Searching…" }));

  let res;
  try {
    res = await fetch(`/api/report?q=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } });
  } catch (err) {
    if (seq !== searchSeq) return;
    body.replaceChildren(
      el("div", { class: "notice notice-error" }, [
        el("strong", { text: "Search unavailable. " }),
        `${err.message}. No results are shown because none were retrieved — this page does not guess at what the docs say.`,
      ]),
    );
    return;
  }

  if (seq !== searchSeq) return;

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || payload.ok !== true) {
    const reason = payload?.error || `the API responded with HTTP ${res.status}`;
    body.replaceChildren(
      el("div", { class: "notice notice-error" }, [
        el("strong", { text: "Search failed. " }),
        `Reason: ${reason}. Nothing below is inferred from that failure.`,
      ]),
    );
    return;
  }

  if (!payload.matchCount) {
    body.replaceChildren(
      el("div", { class: "notice notice-info" }, [
        el("strong", { text: "No literal matches. " }),
        payload.note,
      ]),
      el("p", { class: "hint", text: `Searched ${payload.corpus.pageCount} pages, corpus ${payload.corpus.contentHash.slice(0, 16)}.` }),
    );
    return;
  }

  body.replaceChildren(
    el("p", { class: "hint", text: `${payload.matchCount} page(s) contain "${payload.query}".` }),
    ...payload.matches.map((m) =>
      el("div", { class: "result" }, [
        el("div", { class: "result-head" }, [
          el("a", { href: m.url, target: "_blank", rel: "noopener", text: m.title }),
          el("span", { class: "result-id" }, [
            el("span", { text: m.id }),
            el("span", { class: "occ", text: ` · ${m.occurrences}×` }),
          ]),
        ]),
        el("blockquote", { text: m.snippet }),
      ]),
    ),
  );
}

$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("searchInput").value.trim();
  if (!q) return;
  runSearch(q);
});

// ------------------------------------------------------------------ export

function download(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function wireExports(a) {
  $("btnMd").addEventListener("click", async () => {
    // The markdown lives in the artifact only when the generator kept it; when
    // the snapshot was slimmed, fetch the full report from the API instead of
    // reconstructing prose in the browser.
    if (a.markdown) return download("pharos-mcp-onboard.md", "text/markdown", a.markdown);
    try {
      const res = await fetch("/api/report?format=md");
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      download("pharos-mcp-onboard.md", "text/markdown", await res.text());
    } catch (err) {
      download(
        "pharos-mcp-onboard.md",
        "text/markdown",
        `# report unavailable\n\n${err.message}\n\nThe structured snapshot is still downloadable as JSON.\n`,
      );
    }
  });
  $("btnJson").addEventListener("click", () => {
    download("pharos-mcp-onboard.json", "application/json", JSON.stringify(a, null, 2));
  });
  $("btnMcpMd").addEventListener("click", () => {
    if (MCP_SESSION?.markdown) {
      download("docs-mcp-session-log.md", "text/markdown", MCP_SESSION.markdown);
    }
  });
  $("btnMcpJson").addEventListener("click", () => {
    if (MCP_SESSION) {
      const { markdown: _m, ...rest } = MCP_SESSION;
      download("docs-mcp-session.json", "application/json", JSON.stringify(rest, null, 2));
    }
  });
}

// -------------------------------------------------------------------- boot

function fatal(err) {
  $("summary").replaceChildren();
  $("disclaimer").replaceChildren(
    el("div", { class: "notice notice-error" }, [
      el("strong", { text: "No audit artifact. " }),
      `${err.message}. Run \`npm run audit -- --live\` and reload. Nothing is displayed rather than showing numbers this page cannot source.`,
    ]),
  );
  for (const id of ["panel-gaps", "panel-mcp", "panel-journey", "panel-search"]) $(id).hidden = true;
}

try {
  const audit = assertUsable(AUDIT);
  renderHeader(audit);
  renderSummary(audit);
  renderGaps(audit);
  renderMcpSession(MCP_SESSION);
  renderJourney(audit);
  renderRubric(audit);
  wireExports(audit);
} catch (err) {
  fatal(err);
}
