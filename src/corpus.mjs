// Corpus primitives: turn GitBook's machine-readable docs surface into text we
// can check claims against.
//
// Browser-safe on purpose. No `node:` imports, no Buffer, no fs. The same file is
// imported by the build script, the CLI, the tests, and (verbatim) the dashboard,
// so a verdict rendered in the browser is computed by the exact code that
// produced the CLI report. If this module diverges from its public copy, the
// drift test fails.

const BOILERPLATE_HEADING = /^#\s+Agent Instructions\s*$/m;
const INDEX_PREAMBLE = /^>\s*For the complete documentation index[\s\S]*?\n(?=\n*#)/;

/** GitBook's 200-with-a-not-found-body trap. */
const SOFT_404 = /^#\s+Page Not Found\b/;

export function isSoftNotFound(body) {
  return SOFT_404.test(String(body).trimStart());
}

/**
 * Parse llms.txt into stable entries. `id` is the path with `.md` stripped —
 * human-typable, greppable, and the key every other surface uses.
 */
export function parseLlmsIndex(text) {
  const entries = [];
  for (const line of String(text).split("\n")) {
    // - [Title](https://host/path.md): optional description
    const m = line.match(/^\s*-\s*\[([^\]]+)\]\((\S+?)\)(?::\s*(.*))?$/);
    if (!m) continue;
    const [, rawTitle, mdUrl, description = ""] = m;
    if (!/\.md$/.test(mdUrl)) continue;
    const path = mdUrl.replace(/^https?:\/\/[^/]+/, "").replace(/\.md$/, "");
    entries.push({
      id: path.replace(/^\//, ""),
      title: unescapeMarkdown(rawTitle),
      mdUrl,
      url: mdUrl.replace(/\.md$/, ""),
      description: unescapeMarkdown(description.trim()),
    });
  }
  return entries;
}

/**
 * The export is source markdown for a renderer, not prose. These are the
 * escapes that leak into titles and snippets when you print it raw.
 */
export function unescapeMarkdown(s) {
  return String(s).replace(/\\([_*[\]`()#+\-.!~<>|{}=])/g, "$1");
}

/** Drop the two blocks GitBook appends to every page: the index preamble and
 *  the agent-instructions footer. Neither is documentation content, and both
 *  would otherwise count as "hits" for terms like `ask` or `MCP`. */
export function stripBoilerplate(md) {
  let body = String(md);
  body = body.replace(INDEX_PREAMBLE, "");
  const tail = body.search(BOILERPLATE_HEADING);
  if (tail !== -1) body = body.slice(0, tail);
  return body.trim();
}

/** Headings, in document order, as plain text. */
export function extractHeadings(md) {
  const out = [];
  for (const line of String(md).split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (m) out.push(unescapeMarkdown(m[2].replace(/<[^>]*>/g, "")).trim());
  }
  return out;
}

/**
 * Collapse to searchable text. Fence-aware: fenced content is kept verbatim
 * (that is what a reader copies), only the fence line itself is dropped.
 * Whitespace is collapsed so snippet offsets are identical in node and browser.
 */
export function toPlain(md) {
  const out = [];
  let inFence = false;
  for (const line of String(md).split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) { out.push(line); continue; }
    let prose = line
      // autolinks first, so <https://x> becomes the URL instead of vanishing
      .replace(/<((?:https?|wss?):\/\/[^>\s]+)>/g, "$1")
      .replace(/<[^>]*>/g, "")          // then real inline HTML
      .replace(/!?\[([^\]]*)\]\(([^)\s]+)\)/g, "$1 $2")  // links keep their target
      .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/g, "")        // list bullets
      .replace(/^\s*\|/, "")            // table pipes
      .replace(/\|\s*$/, "")
      .replace(/\|/g, " ");
    prose = unescapeMarkdown(prose);
    out.push(prose);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function looksLikeLanguageTag(s) {
  return /^(?:sh|bash|shell|json|js|javascript|ts|typescript|solidity|sol|python|py|toml|yaml|yml|text|console|http|md|markdown)$/i.test(String(s).trim());
}

/** Character window around a match, on word-ish boundaries. */
export function snippetAround(plain, index, radius = 110) {
  const start = Math.max(0, index - radius);
  const end = Math.min(plain.length, index + radius);
  let head = plain.slice(start, index);
  const tail = plain.slice(index, end);
  if (start > 0) {
    // Cut mid-token: drop the partial word so the snippet does not open with
    // debris, and always mark that text precedes it. Gating the marker on
    // finding a space meant a match inside one long token lost its ellipsis.
    const space = head.indexOf(" ");
    if (space !== -1) head = head.slice(space + 1);
  }
  return (start > 0 ? "…" : "") + head + tail + (end < plain.length ? "…" : "");
}

/**
 * Compile a query. A string is a LITERAL substring; a RegExp is used as-is.
 *
 * This shape is deliberate. An earlier version ran every string through
 * escapeRe(), so a caller who passed an already-escaped pattern got it escaped
 * twice and every count came back 0 — a silent false negative that read exactly
 * like a documentation gap. Plain substrings now go through indexOf and never
 * touch a RegExp, so there is no escaping step to get wrong.
 */
function asMatcher(pattern, { global = false } = {}) {
  if (pattern instanceof RegExp) {
    let flags = pattern.flags;
    if (global && !flags.includes("g")) flags += "g";
    if (!global && flags.includes("g")) flags = flags.replace("g", "");
    return new RegExp(pattern.source, flags);
  }
  if (typeof pattern !== "string") throw new TypeError("pattern must be a string or RegExp");
  const needle = pattern;
  return {
    exec(text) {
      const i = text.indexOf(needle);
      if (i === -1) return null;
      return { index: i, 0: needle, length: 1 };
    },
    all(text) {
      const out = [];
      let i = text.indexOf(needle);
      while (i !== -1) {
        out.push(i);
        i = text.indexOf(needle, i + needle.length || 1);
      }
      return out;
    },
  };
}

/** Every page that mentions a literal or matches a regex, with one snippet each.
 *  This is the only way a verdict earns the word "documented": a page id, a URL,
 *  and the text that supports it. */
export function findInCorpus(pages, pattern, { limit = 5, radius = 110 } = {}) {
  const matcher = asMatcher(pattern);
  const hits = [];
  for (const page of pages) {
    const m = matcher.exec(page.plain);
    if (!m) continue;
    const occurrences = matcher.all ? matcher.all(page.plain).length : countMatches(matcher, page.plain);
    hits.push({
      id: page.id,
      title: page.title,
      url: page.url,
      occurrences,
      snippet: snippetAround(page.plain, m.index, radius),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

function countMatches(matcher, text) {
  const re = new RegExp(matcher.source, matcher.flags.includes("g") ? matcher.flags : matcher.flags + "g");
  const m = text.match(re);
  return m ? m.length : 0;
}

export function countInCorpus(pages, pattern) {
  const matcher = asMatcher(pattern);
  let n = 0;
  for (const page of pages) {
    n += matcher.all ? matcher.all(page.plain).length : countMatches(matcher, page.plain);
  }
  return n;
}

export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Stable hash over content only — never over timestamps or fetch order. */
export function contentHash(pages) {
  const payload = pages
    .map((p) => [p.id, p.title, p.description || "", p.headings.join("|"), p.plain].join("\u0000"))
    .sort()
    .join("\u0001");
  return sha256Hex(payload);
}

/** Small synchronous SHA-256 so the hash is identical in node and browser. */
export function sha256Hex(str) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bytes = [];
  for (const ch of unescape(encodeURIComponent(str))) bytes.push(ch.charCodeAt(0));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  const w = new Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
