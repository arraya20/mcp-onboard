---
name: docs-onboarding-gap-audit
description: Use when auditing documentation for onboarding gaps. Corpus-pinned, five-valued verdicts, live cross-checks.
---

# Auditing docs for onboarding gaps

Use this when the task is "find what is wrong with these docs", "simulate a developer onboarding", or
"produce a DevRel gap report". The deliverable is findings that survive scrutiny: each one reproducible
from a pinned snapshot, each one carrying the page and the sentence that proves it.

The harness in this repo (`docs-mcp-onboarding`) is the reference implementation. Numbers below come from
auditing `docs.pharos.xyz`; the method generalises to any docs site that publishes machine-readable text.

## The failure mode to design against

An audit tool's worst output is a confident finding that is wrong, because nobody checks a report that
agrees with their suspicion. Three real bugs found while building this, all of which produced
plausible-looking falsities:

1. **A matcher that escaped its input.** Passing `https://testnet.example.com` through an escape function
   that had already run made every count zero. Zero hits reads exactly like "the docs never mention this".
   Fix: string patterns use `indexOf`, never a RegExp; only actual `RegExp` values touch the regex engine.
2. **A UI with a hardcoded fallback.** When the API failed, the dashboard rendered a canned result —
   status, gas, block number, and an audit trail claiming it had fetched a receipt. The tool invented
   evidence. Fix: on failure, show the failure and nothing else.
3. **A guard that read prose as code.** The browser-safety test flagged `corpus.mjs` for using `Buffer`
   because a comment said "no Buffer". Fix: strip comments before inspecting, and test the stripper.

Inherited from a sibling project: 13 of 18 rows in a published error table were wrong because the table was
maintained by hand and the test only round-tripped the table against itself. Generate published tables from
the code that uses them, and add a `--check` mode to CI.

## Procedure

### 1. Find the machine-readable surface

Do not scrape HTML. Look for, in order:

- `/llms.txt` — an index of pages with `.md` URLs (GitBook, Mintlify, Docusaurus all emit this)
- `/llms-full.txt` — the whole corpus concatenated, good for a smoke test, bad for citation
- `<page-url>.md` — per-page source

```bash
curl -s https://docs.example/llms.txt -o /tmp/llms.txt
```

If none exist, stop and say so. An audit built on scraped HTML will break on the next redesign.

### 2. Build the corpus, fail closed

Parse the index into `{id, title, url, description}`, then fetch each `.md`. Rules:

- **A page that fails to fetch must fail the build**, not be skipped. A skipped page produces a gap that
  does not exist. Print the failures and exit non-zero.
- **Detect soft 404s.** These sites return HTTP 200 with a `# Page Not Found` body.
- **Strip boilerplate** before counting anything: the index preamble and the "Agent Instructions" footer
  are on every page and will otherwise match terms like "agent" or "ask".
- **Hash the content**, not the fetch order or timestamps, so the report pins a reproducible snapshot.

### 3. Write the journey before writing the probes

List the steps a developer actually takes, in the order they hit them. For a chain: network params → gas →
toolchain → deploy → verify → index → agent access. Each step becomes one probe with:

- `question` — what the developer is trying to do, in their words
- `expectDoc` — what a resolved answer must contain
- `severity` — CRITICAL only when following the docs as written produces a failed transaction or connection
- `evaluate(pages, live)` — returns a status plus a `finding` string, `evidence[]`, `recommendation`, and the
  literal `query` that reproduces it

Never write a probe whose finding is a template with a blank filled in by a count alone. "Found 0 mentions
of X" is only a finding when paired with what the reader is instead told to do.

### 4. Use five verdicts, not two

`RESOLVED`, `GAP`, `UNVERIFIED`, `PARTIAL`, `ERROR`.

A boolean forces the tool to call an untested step either passed (dishonest) or failed (invented). When the
live snapshot is absent, network-dependent probes return `UNVERIFIED`, and the summary states the honest
denominator: `resolution rate` excludes unverified checks rather than counting them as wins.

### 5. Cross-check the claims the docs make about the world

Text-only audits miss the worst bugs. Verify, when the surface allows:

| Claim type | Check |
| --- | --- |
| "RPC is at `https://…`" | POST `eth_chainId`; compare to the published chain ID |
| "Chain ID is N" in several pages | count each value separately; the majority is not the truth, the chain is |
| Two hostnames for one service | fetch both with correct SNI; a cert SAN that misses one is a broken quickstart |
| "N tools available" | call `tools/list` and diff against the names in the page, both directions |

A TLS hostname mismatch is worth ranking CRITICAL for a quickstart: it fails in the developer's own code,
so they blame their setup, not the docs.

### 6. Generate every artifact from one pass

`audit.mjs --live` writes `reports/audit.md`, `reports/audit.json`, and the JS modules the dashboard
imports. The dashboard renders the artifact and computes nothing. One pass, one truth — otherwise the page
and the report drift and someone has to reconcile them by hand.

### 7. Test the tool's honesty, not its coverage

Assertions worth having:

- counts are internally consistent (every check lands in exactly one bucket; severities sum to gaps)
- an offline run never reports `RESOLVED` for a network step
- a probe that throws is `ERROR`, never `GAP` and never a pass
- string patterns match literally, including dots and slashes, and a genuinely absent pattern returns 0
  (so the literal test cannot pass for the wrong reason)
- the dashboard file contains no `innerHTML` assignment and no hardcoded status vocabulary
- the static HTML contains no bare percentage or count — anything numeric must come from the artifact
- generated artifacts carry a do-not-edit banner

## Pitfalls

- **`curl -i` and hex/`-w` output often land in unrelated output streams** in tool harnesses. Write probe
  scripts to files and run them, rather than composing long inline pipelines.
- **Multi-backend DNS hides TLS bugs.** One IP answering correctly says nothing about the others. Test each
  A record with `curl --resolve host:443:ip`, and read the SANs with `openssl s_client | openssl x509 -ext subjectAltName`.
- **Do not pin historical values** (block heights, gas, argument decimals) in assertions; they move. Pin the
  claims the docs make and structural properties of the output.
- **GitBook `.md` escapes leak into snippets** (`command\_api`, `\--verifier-url`). Unescape titles and
  snippets, or every report looks like it was written by a machine that cannot read.
- **A "Foundry" page with no `forge` is a real and common gap.** Check page titles against their own headings
  before assuming a topic is documented; the nav hierarchy lies more often than the search index.

## Verification before claiming done

```bash
npm run build:index && npm run audit:live   # regenerates every artifact
npm test && npm run test:live                # offline, API, live
```

Then open the dashboard, exercise the search box on a term you know exists and one you know does not, and
break the API on purpose (override `window.fetch`) to confirm the page shows an error and no results. A
report is finished when a stranger can reproduce each finding in under a minute.
