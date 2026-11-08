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
    r.evidence.slice(0, 4).map((e) =>
      el("li", {}, [
        el("a", { href: e.url, target: "_blank", rel: "noopener", text: e.id }),
        e.note ? el("span", { class: "note", text: `(${e.note})` }) : null,
        el("blockquote", { text: String(e.snippet).replace(/\s+/g, " ").trim().slice(0, 340) }),
      ]),
    ),
  );
}

function gapDetail(r) {
  return el("article", { class: "detail", id: `gap-${r.id}` }, [
    el("h3", { text: r.title }),
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

  if (resolved.length || other.length) {
    body.append(
      el("div", { class: "rubric" }, [
        el("h2", { text: `Steps that were not gaps (${resolved.length + other.length})` }),
        el(
          "div",
          {},
          [...resolved, ...other].map((r) =>
            el("div", { class: "result" }, [
              el("div", { class: "result-head" }, [
                el("span", { text: r.title }),
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
      el("td", {}, [el("span", { class: "title", text: r.title }), el("span", { class: "question", text: r.question })]),
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

// -------------------------------------------------------------------- tabs

function switchTab(name) {
  for (const key of ["gaps", "journey", "search"]) {
    const tab = $(`tab-${key}`);
    const panel = $(`panel-${key}`);
    const on = key === name;
    tab.setAttribute("aria-selected", String(on));
    panel.hidden = !on;
  }
}

for (const key of ["gaps", "journey", "search"]) {
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
    if (a.markdown) return download("pharos-docs-gap-audit.md", "text/markdown", a.markdown);
    try {
      const res = await fetch("/api/report?format=md");
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      download("pharos-docs-gap-audit.md", "text/markdown", await res.text());
    } catch (err) {
      download(
        "pharos-docs-gap-audit.md",
        "text/markdown",
        `# report unavailable\n\n${err.message}\n\nThe structured snapshot is still downloadable as JSON.\n`,
      );
    }
  });
  $("btnJson").addEventListener("click", () => {
    download("pharos-docs-gap-audit.json", "application/json", JSON.stringify(a, null, 2));
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
  for (const id of ["panel-gaps", "panel-journey", "panel-search"]) $(id).hidden = true;
}

try {
  const audit = assertUsable(AUDIT);
  renderHeader(audit);
  renderSummary(audit);
  renderGaps(audit);
  renderJourney(audit);
  renderRubric(audit);
  wireExports(audit);
} catch (err) {
  fatal(err);
}
