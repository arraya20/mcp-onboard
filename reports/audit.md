# Pharos documentation — first-time developer gap audit

Task `docs-mcp-onboarding`. No documentation MCP server exists for Pharos: `mcp.pharos.xyz` is a chain JSON-RPC server. The audit therefore runs against the documentation corpus itself — **74 pages** of `https://docs.pharos.xyz` (corpus hash `58685967c38888c4`).
Live checks were run against the chain and the MCP server at 2026-11-04T16:31:53.414Z.

All counts below are literal, case-insensitive substring occurrences over the pinned corpus — the same rule the search box uses, so every number here can be reproduced by typing the query. No stemming, no synonyms, no fuzzy matching.

## Summary

| Metric | Value |
| --- | --- |
| Onboarding checks | 8 |
| Resolved by the docs | 2 |
| Gaps | 6 |
| Unverified (no live proof) | 0 |
| Resolution rate | 25% of 8 checks |
| Gaps by severity | CRITICAL 2 · HIGH 2 · MEDIUM 2 · LOW 0 |

Resolution rate counts only checks the docs actually answered. Every check below produced a verdict from evidence.

## Journey

| # | Step | Status | Severity |
| --- | --- | --- | --- |
| 1 | Atlantic Testnet chain ID contradicts itself | GAP | CRITICAL |
| 2 | The testnet endpoints in the quickstart do not work | GAP | CRITICAL |
| 3 | Connect to Pacific Mainnet | RESOLVED | — |
| 4 | There is no documented way to get testnet gas | GAP | HIGH |
| 5 | The Foundry guide does not teach Foundry | GAP | MEDIUM |
| 6 | No bundler or paymaster, so a UserOperation cannot be submitted | GAP | HIGH |
| 7 | The Goldsky page does not explain how to index events | GAP | MEDIUM |
| 8 | Connect an agent over MCP | RESOLVED | — |

## Gaps (6)

### [CRITICAL] Atlantic Testnet chain ID contradicts itself

**Developer question.** Which chain ID do I pass to --chain-id when deploying to Atlantic Testnet?

**Finding.** 8 pages carry 688689 and 4 carry 688688. The live RPC at atlantic.dplabs-internal.com answers eth_chainId with 0xa8231 = 688689, matching the reference page. Of the 7 occurrences of 688688, 2 sit directly under the label "For Atlantic Testnet", where the command then verifies against the Atlantic explorer — an ID that does not match the chain that verifier indexes. None of the 2 pages under getting-started/network/ mention 688688, so the second value has no reference page stating what network it belongs to.

**Evidence.**

_Showing 6 of 12 citing sources._

- `developer-guide/foundry/write-your-first-nft` _(says 688688 under "For Atlantic Testnet")_ — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-nft
  > …\ <contract_address> \ --constructor-args <abi_encoded_args> \ src/Token.sol:Token \ --chain-id 688688 \ --verifier blockscout \ --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/…
- `developer-guide/foundry/write-your-first-token` _(says 688688 under "For Atlantic Testnet")_ — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  > …\ <contract_address> \ --constructor-args <abi_encoded_args> \ src/Token.sol:Token \ --chain-id 688688 \ --verifier blockscout \ --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/…
- `developer-guide/hardhat/write-your-first-nft` _(says 688688)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …----------------------------------------------------------------------------- chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/e…
- `developer-guide/hardhat/write-your-first-token` _(says 688688)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …----------------------------------------------------------------------------- chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/e…
- `developer-guide/foundry/write-your-first-token` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  > …\ <contract_address> \ --constructor-args <abi_encoded_args> \ src/Token.sol:Token \ --chain-id 688689 \ --verifier blockscout \ --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/…
- `developer-guide/hardhat/write-your-first-nft` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-t…

**Reproduce.** Search the corpus for `688688` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Pick one value, confirm it against eth_chainId, and fix every occurrence in one pass. Better: generate the chain ID into the examples from the network reference page so the two cannot drift.

### [CRITICAL] The testnet endpoints in the quickstart do not work

**Developer question.** Can I paste the quickstart's testnet RPC URL into Hardhat and have it connect?

**Finding.** The quickstart's testnet host testnet.dplabs-internal.com does not complete a TLS handshake. The certificate presented for testnet.dplabs-internal.com covers *.zan.top, zan.top and not testnet.dplabs-internal.com, so any HTTPS client fails with a hostname mismatch regardless of which backend serves it. atlantic.dplabs-internal.com does answer, with chain ID 688689. The explorer listed beside the same config, testnet.pharosscan.xyz, is unreachable too: its certificate expired on Feb  5 07:58:19 2026 GMT, so the developer has no way to confirm the deploy landed.

**Evidence.**

_Showing 6 of 7 citing sources._

- `live:testnet.pharosscan.xyz` _(live check)_ — https://testnet.pharosscan.xyz
  > Certificate notAfter Feb 5 07:58:19 2026 GMT — expired before this audit ran. CERT_HAS_EXPIRED: certificate has expired
- `developer-guide/hardhat/write-your-first-nft` _(testnet.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/explorer/command\_api/contrac…
- `developer-guide/hardhat/write-your-first-token` _(testnet.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/explorer/command\_api/contrac…
- `developer-guide/hardhat/write-your-first-nft` _(atlantic.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command\_…
- `developer-guide/hardhat/write-your-first-token` _(atlantic.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command\_…
- `developer-guide/x402/x402-atlantic-testnet` _(atlantic.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet
  > …nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 }, rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com/"] } }, // Pharos RPC endpoint testnet: true, }); // Create wallet client const a…

**Reproduce.** Search the corpus for `testnet.dplabs-internal.com` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Replace the hostname in the Foundry and Hardhat examples with the one the certificate actually covers. This is the worst class of bug for a quickstart: the error surfaces as a TLS failure in the developer's own code.

### [HIGH] There is no documented way to get testnet gas

**Developer question.** Where do I get Atlantic Testnet PHRS?

**Finding.** No URL in the corpus mentions a faucet. "faucet" itself appears 2 times on 1 page, both times as prose telling the reader to use one. The page a developer lands on, Get PROS Gas, covers mainnet acquisition through fiat on-ramps (Halliday, Alchemy Pay, TopNod) — it does not mention a faucet at all.

**Evidence.**

- `tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide` — https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide
  > …**Chain ID:** `688689` **Symbol:** `PHRS` Get testnet PHRS from the Pharos faucet or directly from the team. Export your private key — you will need it when deploying > ⚠️ **Security Wa…

**Reproduce.** Search the corpus for `faucet` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Publish the faucet URL, its rate limit, and any address or balance requirement on the Atlantic Testnet page next to the RPC details. Testnet gas is the first thing that blocks a deploy.

### [MEDIUM] The Foundry guide does not teach Foundry

**Developer question.** I opened the Foundry guide — where is forge?

**Finding.** The page titled "Foundry" never uses the word forge, and never uses Solidity. Its sections are "Write Your First Transaction", "Prerequisites", "Setup 1: Pick Your Favorite Contract Develop Framework and IDE", "Setup 2: Set Up the Project" — it is the ethers.js / web3.js transaction tutorial. Real forge commands exist, but under 4 deeper pages (write-your-first-dapp, write-your-first-nft, write-your-first-token, write-your-first-uniswap-contract), so a developer following the nav hierarchy concludes Foundry is unsupported.

**Evidence.**

- `developer-guide/foundry` — https://docs.pharos.xyz/developer-guide/foundry
  > Foundry / Write Your First Transaction / Prerequisites / Setup 1: Pick Your Favorite Contract Develop Framework and IDE / Setup 2: Set Up the Project / Step 3: Run the Script / Key Points / Troubleshooting / Conclusion
- `developer-guide/foundry/write-your-first-dapp` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-dapp
  > …3: Deploy the Smart Contract Set the private key: export PRIVATE_KEY=<your private key> Then cd contract forge install OpenZeppelin/openzeppelin-contracts --no-git forge script script/Counter.s.sol:CounterScript --r…
- `developer-guide/foundry/write-your-first-nft` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-nft
  > …Install OpenZeppelin Contracts: Foundry uses forge to manage dependencies. Install OpenZeppelin contracts: forge install OpenZeppelin/openzeppelin-contracts --no-git ### Setup 3: Write the NFT Contract Create a New So…
- `developer-guide/foundry/write-your-first-token` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  > …Install OpenZeppelin Contracts: Foundry uses forge to manage dependencies. Install OpenZeppelin contracts: forge install OpenZeppelin/openzeppelin-contracts --no-git ### Setup 3: Write the Token Contract Create a New …
- `developer-guide/foundry/write-your-first-uniswap-contract` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract
  > …Install OpenZeppelin Contracts: Foundry uses forge to manage dependencies. Install OpenZeppelin contracts: forge install OpenZeppelin/openzeppelin-contracts --no-git ### Step 3: Write the Uniswap Contract Create a New…

**Reproduce.** Search the corpus for `forge install` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Either retitle this page to what it is (Send a Transaction with ethers.js) and add a real Foundry landing page, or move the forge deploy/verify content up to it. A section titled Foundry that never says forge is worse than a missing page.

### [HIGH] No bundler or paymaster, so a UserOperation cannot be submitted

**Developer question.** Where is the public bundler RPC and the paymaster for ERC-4337 on Pharos?

**Finding.** "account abstraction" appears 3 times and "4337" 9 times, and the EntryPoint contract address is published on the canonical-contracts page, but "bundler" appears 0 times and "paymaster" 0 times in all 74 pages. Knowing the EntryPoint address is not enough to submit a UserOperation: you need a bundler endpoint that accepts it, and without a paymaster the account must still hold PROS for gas. The docs describe the destination and omit the transport.

**Evidence.**

- `getting-started/canonical-contracts` — https://docs.pharos.xyz/getting-started/canonical-contracts
  > …Permit2 Next-generation token approval system 0x000000000022D473030F116dDEE9F6B43aC78BA3 EntryPoint (v0.7.0) ERC-4337 entry point for account abstraction 0x0000000071727De22E5E9d8BAf0edAc6f37da032 Se…

**Reproduce.** Search the corpus for `bundler` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Add an ERC-4337 page: bundler RPC URL(s) with their rate limits, a minimal UserOperation example against the published EntryPoint, and whether any paymaster is available on Atlantic. Link it from the canonical contracts table where the EntryPoint is already listed.

### [MEDIUM] The Goldsky page does not explain how to index events

**Developer question.** How do I create a subgraph for my contract on Pharos?

**Finding.** The Goldsky page is 2453 characters of positioning: 7 headings, 1 outbound link to goldsky.com, and no endpoint, no API-key or login step, and no config example. The provider list names Goldsky as the only indexing option, so this page is the entire indexing story on Pharos, and it ends where the work starts.

**Evidence.**

- `tooling-and-infrastructure/indexing/goldsky` — https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky
  > # Goldsky Goldsky is a high-performance data indexing provider that makes it easy to extract, transform, and load on-chain data to power both application and analytics use cases. ## Indexing Pharos with Goldsky Goldsky is Web3’s realtime da

**Reproduce.** Search the corpus for `goldsky` — via the box on the dashboard, or run `node scripts/verify-claims.mjs` to recount every number in this report.

**Recommendation.** Add the Pharos network entry for the Goldsky CLI, an API-key step, and a minimal subgraph.yaml plus a query example against a deployed Pharos subgraph. Even a link straight to the Pharos-specific Goldsky quickstart would unblock this.

## Checks the docs answer (2)

**RESOLVED** — Connect to Pacific Mainnet

> Documented endpoint https://rpc.pharos.xyz answers eth_chainId with 0x688 = 1672, matching the published chain ID.

**RESOLVED** — Connect an agent over MCP

> This step resolves cleanly. All 14 tools exposed by the live server are documented, no documented tool is missing, and the documented /health response matches the server exactly (chainId 1672). The page also specifies transport, auth, rate limit, block-parameter forms, and the 1000-block cap on get_logs.

## Severity rubric

- **CRITICAL** — Following the docs as written produces a failed transaction or a failed connection. The developer cannot proceed, and the docs look correct while doing it.
- **HIGH** — The developer must leave the docs and find the answer elsewhere, or guess. The task is possible but blocked on missing information.
- **MEDIUM** — The developer can proceed but wastes time on a detour the docs created — wrong page title, missing example, or a link that dead-ends.
- **LOW** — Polish. Incomplete but not misleading.

---

Every finding above is reproducible: the corpus hash pins the documentation snapshot, and each gap names the query that surfaced it. Regenerate with `npm run audit`.
