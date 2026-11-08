#!/usr/bin/env node
// Build the corpus index from the live docs site.
//
// Rules this file exists to enforce:
//   1. The page list comes from llms.txt, never from a hardcoded array and never
//      from a crawl of rendered HTML. Rebuild after the docs change.
//   2. Any page failure aborts the build. A silently partial corpus makes every
//      "term not found" verdict a lie, which is the one bug that matters here.
//   3. The artifact is byte-identical across runs over identical content. No
//      per-page timestamps, hash over content fields only.
//   4. src/corpus.mjs is copied to public/corpus.mjs verbatim. The dashboard must
//      run the same code the CLI does, or its verdicts are a second opinion.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseLlmsIndex,
  stripBoilerplate,
  extractHeadings,
  toPlain,
  isSoftNotFound,
  contentHash,
} from "../src/corpus.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://docs.pharos.xyz";
const INDEX_URL = `${SOURCE}/llms.txt`;
const WORKERS = 6;
const TIMEOUT_MS = 30_000;

async function getText(url, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "text/markdown,text/plain,*/*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    if (!body.trim()) throw new Error("empty body");
    return body;
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      return getText(url, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function banner(kind) {
  return `// GENERATED FILE — do not edit by hand.\n// Produced by scripts/build-index.mjs from ${INDEX_URL}\n// (${kind})\n`;
}

async function main() {
  const started = Date.now();
  process.stdout.write(`fetching ${INDEX_URL}\n`);
  const indexText = await getText(INDEX_URL);
  const entries = parseLlmsIndex(indexText);
  if (entries.length < 10) throw new Error(`llms.txt parsed to only ${entries.length} entries — refusing to build`);
  process.stdout.write(`${entries.length} pages in the index\n`);

  const pages = [];
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      try {
        const body = await getText(entry.mdUrl);
        if (isSoftNotFound(body)) throw new Error("soft-404: host returned 200 with a not-found body");
        const doc = stripBoilerplate(body);
        if (!doc) throw new Error("empty after boilerplate strip");
        pages.push({
          id: entry.id,
          title: entry.title,
          url: entry.url,
          mdUrl: entry.mdUrl,
          description: entry.description,
          headings: extractHeadings(doc),
          text: doc,
          plain: toPlain(doc),
        });
      } catch (err) {
        failures.push({ id: entry.id, reason: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, worker));

  if (failures.length) {
    console.error(`\n${failures.length} page(s) failed — refusing to write an index that would`);
    console.error("report documentation gaps caused by our own fetch errors:\n");
    for (const f of failures) console.error(`  ${f.id}: ${f.reason}`);
    process.exit(1);
  }

  pages.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const meta = {
    source: SOURCE,
    indexUrl: INDEX_URL,
    pageCount: pages.length,
    contentHash: contentHash(pages),
    totalPlainChars: pages.reduce((n, p) => n + p.plain.length, 0),
  };

  await mkdir(path.join(ROOT, "data"), { recursive: true });

  await writeFile(
    path.join(ROOT, "data", "corpus.json"),
    JSON.stringify({ meta, pages }, null, 2) + "\n",
  );

  // Browser artifact: no `text` (the raw markdown stays node-only) and no mdUrl,
  // because every consumer of this file only ever needs `plain`.
  const slim = pages.map(({ id, title, url, description, headings, plain }) => ({
    id, title, url, description, headings, plain,
  }));
  await writeFile(
    path.join(ROOT, "public", "corpus.generated.js"),
    banner("slim corpus for the dashboard") +
      `export const CORPUS = ${JSON.stringify({ meta, pages: slim })};\n`,
  );

  // No verbatim copy of src/corpus.mjs is written any more. The dashboard is not
  // allowed to recompute a verdict from raw corpus text — it renders the audit
  // artifact — so a second copy of the matching code in public/ would be dead
  // weight that can silently drift. The browser-safety test asserts instead that
  // everything under src/ is importable without a Node builtin.

  const kb = (Buffer.byteLength(JSON.stringify(slim)) / 1024).toFixed(0);
  process.stdout.write(
    `\nwrote data/corpus.json + public/corpus.generated.js\n` +
      `  pages        ${meta.pageCount}\n` +
      `  plain chars  ${meta.totalPlainChars}\n` +
      `  browser kb   ${kb}\n` +
      `  contentHash  ${meta.contentHash}\n` +
      `  built in     ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
}

main().catch((err) => {
  console.error(`build failed: ${err.message}`);
  process.exit(1);
});
