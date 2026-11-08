# Pharos docs — self-onboarding gap audit

Pharos Agent Arena, task `docs-mcp-onboarding`.

- **Live demo:** [https://mcp-onboard.nampharos.web.id](https://mcp-onboard.nampharos.web.id)
- **Repository:** [https://github.com/arraya20/mcp-onboard](https://github.com/arraya20/mcp-onboard)

## Deliverables

| Task requirement | Where it is |
| --- | --- |
| Step-by-step log of queries and answers, Docs MCP only | [`docs/mcp-session-log.md`](docs/mcp-session-log.md) — 9 steps, 17 calls, answers quoted verbatim |
| At least 3 gaps, each with the exact query | same file, "Gaps and suggested fixes" — 7 gaps |
| A suggested fix for each gap | same section, "What the docs should say" |
| What was built or run by the end | same file, "What I managed to build or run by the end" |

The log is generated, not hand-written: `npm run mcp:session` replays the journey against
`https://docs.pharos.xyz/~gitbook/mcp` and records every call to `data/mcp-session.json`;
`npm run mcp:render` rebuilds `docs/mcp-session-log.md` and `public/mcp-session.generated.js` from that file offline;
`npm run mcp:check` fails if either differs.
The session holds no wallet, so no contract was deployed — the log says so.

The rest of this README describes the **cross-check**: a second pass over a pinned snapshot of the docs,
plus live probes of the chain, TLS certificates and the chain MCP. Those probes go beyond the Docs MCP,
so the certificate and chain-ID evidence in the log's Gaps 1 and 2 comes from here, not from the MCP.
The cross-check has 8 checks (the log has 9 steps; the log adds a LOW finding about discovering the
Docs MCP itself, which is a question about the MCP rather than the corpus).

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

Steps 4–7 are answered from the documentation corpus alone. Steps 1–3 and 8 need the network to answer —
chain IDs, TLS reachability, explorer certificates, the MCP tool list — so they are separate and optional,
and an offline run reports them as UNVERIFIED instead of pretending to have tested the network.

## Current result

Run against a 74-page snapshot of `docs.pharos.xyz` with live verification:

```
8 checks · 2 resolved · 6 gaps · 0 unverified
severity: CRITICAL 2 · HIGH 2 · MEDIUM 2 · LOW 0
resolution rate: 25%
```

- **CRITICAL — the docs contradict themselves on the Atlantic chain ID.** The network page publishes
  `688689`, and the live Atlantic RPC agrees (`eth_chainId` → `0xa8231`). But `688688` appears on 4 pages,
  and on 2 of those occurrences it sits directly under the heading **"For Atlantic Testnet"** — a
  `forge verify-contract` command told to use an ID that is not the chain its own verifier URL indexes.
  The remaining occurrences belong to a second, undocumented "Testnet" whose reference page does not
  exist: no page under `getting-started/network/` mentions `688688` at all.
- **CRITICAL — the quickstart's testnet endpoints do not work.** `testnet.dplabs-internal.com`, the host in
  the Hardhat config, presents a certificate for `*.zan.top`, so every HTTPS client fails with a hostname
  mismatch — on the same three backends that serve the working name, so it is a cert bug, not a dead host.
  Beside it, the explorer `testnet.pharosscan.xyz` serves a certificate that expired in February 2026, so
  the developer cannot confirm the deploy either. `atlantic.dplabs-internal.com` answers fine (`688689`).
- **HIGH — no faucet URL exists anywhere in the corpus.** "faucet" appears twice, both on the same page,
  both as prose telling the reader to use one. Not one URL in the corpus mentions a faucet. The Get PROS
  Gas page a developer actually lands on covers mainnet fiat on-ramps only.
- **HIGH — ERC-4337 is half documented.** The canonical-contracts page publishes the EntryPoint address,
  and "4337" appears 9 times; the words "bundler" and "paymaster" appear zero times in 74 pages.
- **MEDIUM — the page titled "Foundry" contains no Foundry.** It never says `forge`, and never says
  Solidity. Its headings are the ethers.js transaction tutorial. Four deeper pages do run `forge`.
- **MEDIUM — the Goldsky page is 2.4 KB of positioning.** No endpoint, no API-key step, no config example.
  (2453 characters of plain text in the corpus; 2488 as `getPage` returns it with markup.)

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
        │  8 probes, each a claim   │  chain IDs, TLS SANs, explorer certs,
        │                           │  MCP tools/list
        ▼                           ▼
   src/audit.mjs ── buildAudit(corpus, live) ──► reports/audit.md
                                             ├─► reports/audit.json
                                             ├─► public/audit.generated.js
                                             └─► public/report.generated.js
```

The dashboard renders `audit.generated.js`. It does not re-derive verdicts, so what you see in the browser
is byte-identical to the CLI report.

Every number in `reports/audit.md` is interpolated from a count, never typed into the prose, and
`npm run verify:claims` recounts all of them from `data/corpus.json` and fails if the report disagrees.
That gate exists because the first draft of this report had the counts written by hand: it said "faucet
appears once" when the word appears twice, and "under 6 deeper pages" while listing three in the same
sentence. Numbers written next to a claim drift away from the claim, silently.

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
npm test                # 41 offline + 14 report-claim + 15 API assertions
npm run test:live       # 10 assertions against mainnet and the MCP server
npm run mcp:session     # replay the journey against the Docs MCP (network), rewrite data/ and docs/
npm run mcp:render      # rebuild docs/mcp-session-log.md from data/mcp-session.json (offline)
npm run mcp:check       # fail if the log is not exactly what the raw session renders to
npm run verify:claims   # recount every number in reports/audit.md from the corpus
npm run serve           # dashboard on http://127.0.0.1:8793
```

Requirements: Node 20+ (uses the built-in test runner and `fetch`). No `npm install` — there are
no dependencies, and nothing here imports `ethers` or `viem`. `wrangler` is pulled through `npx`
for the dashboard only.

## Deploying

```bash
npx wrangler login      # once
npm run deploy          # reads wrangler.toml, uploads public/ and functions/
```

`wrangler.toml` pins `compatibility_date` and sets `pages_build_output_dir`, so the deploy needs no
flags and does not inherit a moving runtime default. The Function bundle is ~118 KB gzipped, well
inside the Workers limit. Nothing needs an API key, a database, or a build step: `data/corpus.json`
and the `*.generated.js` artifacts are committed.

Regenerate the artifacts and re-run the audit before deploying, or the site ships yesterday's
findings:

```bash
npm run build:index && npm run audit:live && npm test
```

## API

| Request | Result |
| --- | --- |
| `GET /api/report` | the audit snapshot (JSON) |
| `GET /api/report?format=md` | the same report as Markdown |
| `GET /api/report?format=mcp` | the Docs MCP onboarding session (JSON) |
| `GET /api/report?format=mcp-md` | the Docs MCP session log (`docs/mcp-session-log.md`) as Markdown |
| `GET /api/report?q=faucet` | literal, case-insensitive substring search over the pinned corpus |

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
- **The search endpoint matches substrings.** It is case-insensitive, so `paymaster` does find
  `Paymasters` — but it will also match inside an unrelated word, and a plural or a hyphen breaks the hit.
- **`eth_call`-level claims are out of scope.** This audits documentation, not contracts.

## Repository layout

```
src/corpus.mjs     parsing, plain-text collapsing, literal search, sha256   (browser-safe)
src/probes.mjs     the eight checks, as data with an evaluate()
src/audit.mjs      aggregation, severity rubric, Markdown renderer           (browser-safe)
src/live.mjs       chain / TLS / explorer certs / MCP verification          (node only)
src/docsmcp.mjs    minimal client for the Developer Docs MCP                (node only)
scripts/           corpus build (build-index.mjs), audit run (audit.mjs),
                   claim recount (verify-claims.mjs),
                   Docs MCP session + log render (mcp-session.mjs)
docs/              mcp-session-log.md — the task deliverable
data/              corpus.json (pinned docs), mcp-session.json (raw MCP responses)
functions/api/     the read-only Pages Function
public/            dashboard + generated artifacts
reports/           committed audit.md and audit.json
test/              41 offline, 14 claim, 15 API, 10 live assertions
```

`src/corpus.mjs`, `src/probes.mjs` and `src/audit.mjs` import nothing from Node — a test enforces this by
stripping comments and grepping for `node:`, `Buffer` and `process`. That is what lets the same code run in
the Worker and in the CLI.

## License

MIT. See `LICENSE`.
