# Pharos docs — self-onboarding gap audit

Pharos Agent Arena, task `docs-mcp-onboarding`.

Eight steps take a developer from "I want to build on Pharos" to "my contract is deployed and indexed".
This project walks that journey, checks each step against the published documentation, and reports where a
first-time developer gets stuck — with the page, the URL, and the sentence that proves it.

The output is not an opinion. Every verdict names a corpus hash, the query that reproduced it, and the
evidence snippet that supports it.

---

## What it actually checks

| # | Step | Question a new developer asks |
| --- | --- | --- |
| 1 | Network | What is the Atlantic chain ID, and is it consistent across every example? |
| 2 | Network | Does the quickstart's testnet RPC URL actually connect? |
| 3 | Network | What is the Pacific RPC, and does it still answer? |
| 4 | Gas | Where do I get testnet PHRS to pay for a deploy? |
| 5 | Toolchain | I opened the Foundry guide — where is `forge`? |
| 6 | Account abstraction | Where is the bundler, and is there a paymaster? |
| 7 | Indexing | How do I get a subgraph indexing my contract? |
| 8 | Agent access | What are the MCP endpoint, transport, auth model, and tools? |

Steps 1–3, 5–8 are answered from the documentation corpus alone. The live checks (chain IDs, TLS
reachability, MCP tool list) are separate and optional, so an offline run never pretends to have tested
the network.

## Current result

Run against a 74-page snapshot of `docs.pharos.xyz` with live verification:

```
8 checks · 2 resolved · 6 gaps · 0 unverified
severity: CRITICAL 2 · HIGH 2 · MEDIUM 2 · LOW 0
resolution rate: 25%
```

- **CRITICAL — the docs contradict themselves on the Atlantic chain ID.** 8 pages say `688689`,
  4 pages say `688688`, including the `forge create` and Hardhat configs. The live Atlantic RPC answers
  `688689`, so the 4 pages are wrong. Copying them means signing for a chain that does not exist.
- **CRITICAL — `testnet.dplabs-internal.com` cannot be reached over HTTPS.** It is the host in the Hardhat
  quickstart. The certificate served for that hostname covers `*.zan.top`, so every client fails with a
  hostname mismatch. `atlantic.dplabs-internal.com` is the working name, on the same backends.
- **HIGH — no faucet URL exists anywhere in the corpus.** "faucet" appears once, as prose telling the
  reader to use one. The Get PROS Gas page covers mainnet fiat on-ramps only.
- **HIGH — ERC-4337 is half documented.** EntryPoint v0.6 and v0.7 addresses are published; the words
  "bundler" and "paymaster" appear zero times in 74 pages.
- **MEDIUM — the page titled "Foundry" contains no Foundry.** Zero mentions of `forge`. Its headings are
  the ethers.js transaction tutorial. `forge` lives six pages deeper.
- **MEDIUM — the Goldsky page is 2.4 KB of positioning.** No endpoint, no API-key step, no config example.

Two steps resolve cleanly: the Pacific RPC, and the Pharos MCP page — whose tool list matches the live
server exactly, all 14 tools, and whose `/health` response is reproduced verbatim. That page is the model
the rest should follow.

## How it works

```
docs.pharos.xyz/llms.txt
        │  scripts/build-index.mjs  (fetch each .md, strip boilerplate, hash)
        ▼
   data/corpus.json ────────────────┐
        │                           │
        │  src/probes.mjs           │  src/live.mjs  (optional)
        │  8 probes, each a claim   │  chain IDs, TLS SANs, MCP tools/list
        ▼                           ▼
   src/audit.mjs ── buildAudit(corpus, live) ──► reports/audit.md
                                             ├─► reports/audit.json
                                             ├─► public/audit.generated.js
                                             └─► public/report.generated.js
```

The dashboard renders `audit.generated.js`. It does not re-derive verdicts, so what you see in the browser
is byte-identical to the CLI report.

### Verdicts are five-valued, on purpose

`RESOLVED`, `GAP`, `UNVERIFIED`, `PARTIAL`, `ERROR`.

The usual audit tool has two states, and that forces a lie: a step it could not test has to be called
either passing or failing. `UNVERIFIED` means "we did not have the evidence", and it is never counted as
resolved. When `npm run audit` runs without `--live`, every network-dependent step lands here — the report
says so instead of quietly scoring them as wins.

## Running it

```bash
npm run build:index     # fetch the docs corpus, write data/corpus.json
npm run audit           # offline audit: corpus only
npm run audit:live      # + chain, TLS and MCP checks
npm test                # 36 offline assertions + 15 API assertions
npm run test:live       # 10 assertions against mainnet and the MCP server
npm run serve           # dashboard on http://127.0.0.1:8793
```

Requirements: Node 20+, `wrangler` for the dashboard. No `ethers`, no `viem`, no database.

## API

| Request | Result |
| --- | --- |
| `GET /api/report` | the audit snapshot (JSON) |
| `GET /api/report?format=md` | the same report as Markdown |
| `GET /api/report?q=faucet` | literal substring search over the pinned corpus |

The search endpoint is deliberately dumb: case-insensitive literal match, no stemming, no synonyms, no
ranking. When it returns zero results it says, in the response body, that zero literal matches is not proof
the topic is undocumented — because that inference is the exact mistake this whole project is about.

Failure modes are explicit. A missing artifact is a 500 with the command that regenerates it, an empty `q`
is a 400 rather than a full-corpus dump, and a query over 200 characters is rejected with the limit named.
The dashboard mirrors this: if the API fails, it shows the reason and no results. It never falls back to a
plausible-looking default.

## Limitations

- **The corpus is a snapshot.** It is pinned by hash, so results are reproducible, but the docs move. Rerun
  `npm run build:index && npm run audit:live` to refresh. If a gap is fixed upstream, the live test fails
  loudly — that is intentional, it means a finding needs updating rather than silently going stale.
- **Probes are keyword-shaped.** "Zero mentions of paymaster" is a fact about the text, and a strong signal
  that the topic is missing, but it cannot tell whether an answer exists in a video, a Discord thread, or a
  page that uses different vocabulary.
- **The search endpoint matches substrings.** `paymaster` fails to find `Paymasters` only if the page spells
  it differently; it will happily match inside an unrelated word.
- **`eth_call`-level claims are out of scope.** This audits documentation, not contracts.

## Repository layout

```
src/corpus.mjs     parsing, plain-text collapsing, literal search, sha256   (browser-safe)
src/probes.mjs     the eight checks, as data with an evaluate()
src/audit.mjs      aggregation, severity rubric, Markdown renderer           (browser-safe)
src/live.mjs       chain / TLS / MCP verification                           (node only)
scripts/           corpus build, audit run
functions/api/     the read-only Pages Function
public/            dashboard + generated artifacts
reports/           committed audit.md and audit.json
test/              36 offline, 15 API, 10 live assertions
```

`src/corpus.mjs`, `src/probes.mjs` and `src/audit.mjs` import nothing from Node — a test enforces this by
stripping comments and grepping for `node:`, `Buffer` and `process`. That is what lets the same code run in
the Worker and in the CLI.

## License

MIT. See `LICENSE`.
