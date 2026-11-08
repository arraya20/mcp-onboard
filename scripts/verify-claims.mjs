#!/usr/bin/env node
// Recount every number the report states, straight from the corpus, and compare.
//
//   node scripts/verify-claims.mjs            # human-readable table, exit 1 on drift
//   node scripts/verify-claims.mjs --json     # machine-readable
//
// Why this exists: the first version of the report had the counts written by
// hand inside the prose. It claimed "faucet appears once" when the word appears
// twice, and "under 6 deeper pages" while listing three. Numbers typed next to
// a claim drift from the claim, silently, and a report nobody can re-derive is
// just an opinion with a table in it.
//
// checkClaims() is the only implementation. test/claims.test.mjs imports it
// rather than re-deriving the same numbers a second way, so the CLI and the
// gate can never disagree with each other.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Same rule as src/corpus.mjs and the HTTP search endpoint: literal, case-insensitive.
const fold = (s) => s.toLowerCase();
const count = (pages, needle) => pages.reduce((n, p) => n + fold(p.plain).split(fold(needle)).length - 1, 0);
const containing = (pages, needle) => pages.filter((p) => fold(p.plain).includes(fold(needle)));

/** How many occurrences of `needle` sit under a "For Atlantic Testnet" label. */
function underAtlanticLabel(pages, needle) {
  const flags = [];
  for (const p of pages) {
    const hay = fold(p.plain);
    let i = hay.indexOf(fold(needle));
    while (i !== -1) {
      const before = p.plain.slice(Math.max(0, i - 240), i);
      const labels = [...before.matchAll(/for\s+((?:atlantic\s+)?testnet)/gi)];
      const label = labels.length ? labels[labels.length - 1][1].toLowerCase() : "";
      flags.push(label.includes("atlantic"));
      i = hay.indexOf(fold(needle), i + needle.length);
    }
  }
  return { total: flags.length, atlantic: flags.filter(Boolean).length };
}

/**
 * @returns {{claim: string, expected: string, ok: boolean}[]}
 */
export function checkClaims({ pages, report }) {
  const rows = [];
  const has = (claim, expected) => {
    rows.push({ claim, expected, ok: report.includes(expected) });
  };

  // --- chain ID
  const right = containing(pages, "688689").length;
  const wrong = containing(pages, "688688").length;
  has("688689 appears on this many pages", `${right} pages carry 688689 and ${wrong} carry 688688`);

  const occ = underAtlanticLabel(pages, "688688");
  has(
    "occurrences of 688688 that sit under the Atlantic label",
    `Of the ${occ.total} occurrences of 688688, ${occ.atlantic} sit${occ.atlantic === 1 ? "s" : ""} directly under`,
  );

  const net = pages.filter((p) => p.id.startsWith("getting-started/network/"));
  const netWith = net.filter((p) => fold(p.plain).includes("688688"));
  if (!netWith.length) {
    has("no network reference page states 688688", `None of the ${net.length} pages under getting-started/network/ mention`);
  }

  // --- faucet
  const faucetOcc = count(pages, "faucet");
  const faucetPages = containing(pages, "faucet").length;
  has(
    "faucet occurrences vs pages",
    `"faucet" itself appears ${faucetOcc} time${faucetOcc === 1 ? "" : "s"} on ${faucetPages} page${faucetPages === 1 ? "" : "s"}`,
  );
  const faucetUrls = (pages.map((p) => p.plain).join(" ").match(/https?:\/\/[^\s)\]]*faucet[^\s)\]]*/gi) || []).length;
  if (faucetUrls === 0) has("no faucet URL is published", "No URL in the corpus mentions a faucet");

  // --- foundry
  const sub = pages.filter((p) => p.id.startsWith("developer-guide/foundry/") && /\bforge\b/i.test(p.plain));
  has("pages under the Foundry tree that run forge", `under ${sub.length} deeper page`);
  for (const p of sub) has(`subpage ${p.id} is named`, p.id.replace("developer-guide/foundry/", ""));

  // --- account abstraction
  const bundler = count(pages, "bundler");
  const paymaster = count(pages, "paymaster");
  has(
    "bundler and paymaster counts",
    `"bundler" appears ${bundler} time${bundler === 1 ? "" : "s"} and "paymaster" ${paymaster} time${paymaster === 1 ? "" : "s"}`,
  );

  // --- goldsky
  const g = pages.find((p) => p.id === "tooling-and-infrastructure/indexing/goldsky");
  if (g) {
    const links = new Set(
      (g.plain.match(/https?:\/\/(?:[^\s/]*\.)?goldsky\.com[^\s]*/gi) || []).map((u) => u.replace(/[.,;:)\]]+$/, "")),
    ).size;
    has("goldsky page size and headings", `is ${g.plain.length} characters of positioning: ${g.headings.length} headings`);
    has("goldsky outbound link count", `${links} outbound link${links === 1 ? "" : "s"} to goldsky.com`);
  }

  return rows;
}

async function main() {
  const corpus = JSON.parse(await readFile(path.join(ROOT, "data", "corpus.json"), "utf8"));
  const report = await readFile(path.join(ROOT, "reports", "audit.md"), "utf8");
  const rows = checkClaims({ pages: corpus.pages, report });

  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  } else {
    process.stdout.write(`\nrecounting ${rows.length} claims against ${corpus.pages.length} pages\n\n`);
    for (const r of rows) {
      process.stdout.write(`  ${r.ok ? "ok  " : "FAIL"}  ${r.claim}\n`);
      if (!r.ok) process.stdout.write(`        report does not contain: ${r.expected}\n`);
    }
  }

  const bad = rows.filter((r) => !r.ok);
  process.stdout.write(`\n${rows.length - bad.length}/${rows.length} claims reproduce\n`);
  // A drifted number means the report is stating something the corpus does not
  // support, which is the one failure mode this whole project exists to prevent.
  if (bad.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
