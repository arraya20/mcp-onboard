// GET /api/report          → the audit snapshot produced by `npm run audit`
// GET /api/report?q=...    → source-level search over the pinned corpus
//
// Both read generated artifacts. The handler does not evaluate probes and does
// not call the network, so an answer here always traces back to a corpus hash
// and an audit run that a reader can reproduce offline.
//
// Failure posture: a missing artifact is a 500 with a reason, never an empty
// success. A search with no hits is a 200 with zero matches — that is a real
// answer, and the difference between "nothing matched" and "we did not look"
// has to stay visible to the caller.

import { AUDIT } from "../../public/audit.generated.js";
import { CORPUS } from "../../public/corpus.generated.js";
import { REPORT_MD } from "../../public/report.generated.js";
import { MCP_SESSION } from "../../public/mcp-session.generated.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  // The artifact is pinned, so let the edge cache it briefly.
  "cache-control": "public, max-age=300",
};

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: JSON_HEADERS });
}

/** Literal, case-insensitive substring search. Same rule as the CLI: no regex,
 *  no tokeniser, no synonyms. A hit means the corpus contains those characters. */
function searchCorpus(pages, query, limit = MAX_RESULTS) {
  const needle = query.toLowerCase();
  const hits = [];
  for (const page of pages) {
    const haystack = page.plain.toLowerCase();
    const index = haystack.indexOf(needle);
    if (index === -1) continue;
    let occurrences = 0;
    for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length || 1)) {
      occurrences += 1;
      if (occurrences > 999) break;
    }
    const start = Math.max(0, index - 140);
    const end = Math.min(page.plain.length, index + 140);
    hits.push({
      id: page.id,
      title: page.title,
      url: page.url,
      occurrences,
      snippet: (start > 0 ? "…" : "") + page.plain.slice(start, end).replace(/\s+/g, " ") + (end < page.plain.length ? "…" : ""),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  if (!AUDIT || !Array.isArray(AUDIT.results)) {
    return json(
      { ok: false, error: "audit artifact missing or malformed — run `npm run audit -- --live` to regenerate" },
      500,
    );
  }
  if (!CORPUS || !Array.isArray(CORPUS.pages)) {
    return json(
      { ok: false, error: "corpus artifact missing — run `npm run build:index` to regenerate" },
      500,
    );
  }

  if (url.searchParams.get("format") === "md") {
    if (typeof REPORT_MD !== "string" || !REPORT_MD.length) {
      return json({ ok: false, error: "markdown artifact missing — run `npm run audit -- --live`" }, 500);
    }
    return new Response(REPORT_MD, {
      status: 200,
      headers: { ...JSON_HEADERS, "content-type": "text/markdown; charset=utf-8" },
    });
  }

  if (url.searchParams.get("format") === "mcp-md") {
    if (!MCP_SESSION || typeof MCP_SESSION.markdown !== "string" || !MCP_SESSION.markdown.length) {
      return json({ ok: false, error: "Docs MCP session artifact missing — run `npm run mcp:render`" }, 500);
    }
    return new Response(MCP_SESSION.markdown, {
      status: 200,
      headers: { ...JSON_HEADERS, "content-type": "text/markdown; charset=utf-8" },
    });
  }

  if (url.searchParams.get("format") === "mcp") {
    if (!MCP_SESSION || !Array.isArray(MCP_SESSION.steps)) {
      return json({ ok: false, error: "Docs MCP session artifact missing — run `npm run mcp:render`" }, 500);
    }
    const { markdown: _m, ...rest } = MCP_SESSION;
    return json({ ok: true, mcpSession: rest });
  }

  if (q === null) {
    const { markdown: _md, ...rest } = AUDIT;
    return json({ ok: true, audit: rest });
  }

  const query = q.trim();
  if (!query) {
    return json({ ok: false, error: "q must not be empty" }, 400);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return json({ ok: false, error: `q must be at most ${MAX_QUERY_LENGTH} characters` }, 400);
  }

  const matches = searchCorpus(CORPUS.pages, query);
  return json({
    ok: true,
    query,
    matchCount: matches.length,
    matches,
    corpus: {
      source: CORPUS.meta.source,
      pageCount: CORPUS.meta.pageCount,
      contentHash: CORPUS.meta.contentHash,
    },
    // State the limit of the answer instead of letting the caller infer that
    // zero matches means "the docs do not cover this". Zero matches means zero
    // literal matches, which is weaker.
    note:
      matches.length === 0
        ? "No page contains this text literally. That is not proof the topic is undocumented — try a shorter phrase or a term the docs would actually use."
        : "Literal substring matches over the pinned corpus. No stemming, no synonyms.",
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}
