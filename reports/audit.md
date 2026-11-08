# Pharos Docs MCP — Self-Onboarding Gap Audit

Audited **74 pages** of `https://docs.pharos.xyz` (corpus hash `58685967c38888c4`).
Live checks were run against the chain and the MCP server at 2026-11-04T16:13:10.506Z.

## Summary

| Metric | Value |
| --- | --- |
| Onboarding checks | 8 |
| Resolved by the docs | 2 |
| Gaps | 6 |
| Unverified (no live proof) | 0 |
| Resolution rate | 25% of 8 checks |
| Gaps by severity | CRITICAL 2 · HIGH 2 · MEDIUM 2 · LOW 0 |

Resolution rate counts only checks the docs actually answered. 0 check(s) could not be verified and are excluded from the numerator rather than assumed good.

## Journey

| # | Step | Status | Severity |
| --- | --- | --- | --- |
| 1 | Atlantic Testnet chain ID is self-consistent | GAP | CRITICAL |
| 2 | The testnet RPC URL in the quickstart actually connects | GAP | CRITICAL |
| 3 | Connect to Pacific Mainnet | RESOLVED | — |
| 4 | Get testnet gas to deploy | GAP | HIGH |
| 5 | The Foundry guide teaches Foundry | GAP | MEDIUM |
| 6 | Submit a UserOperation: bundler and paymaster | GAP | HIGH |
| 7 | Index contract events with Goldsky | GAP | MEDIUM |
| 8 | Connect an agent over MCP | RESOLVED | — |

## Gaps (6)

### [CRITICAL] Atlantic Testnet chain ID is self-consistent

**Developer question.** Which chain ID do I pass to --chain-id when deploying to Atlantic Testnet?

**Finding.** The docs contradict themselves. 8 pages use 688689; 4 pages use 688688 — including the deploy and verify commands. The live Atlantic RPC reports 688689, so 688689 is the correct value and 688688 is wrong. A developer copying the Foundry or Hardhat example signs for a chain that does not exist.

**Evidence.**

- `developer-guide/foundry/write-your-first-token` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  > …\ <contract_address> \ --constructor-args <abi_encoded_args> \ src/Token.sol:Token \ --chain-id 688689 \ --verifier blockscout \ --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/…
- `developer-guide/hardhat/write-your-first-nft` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-t…
- `developer-guide/hardhat/write-your-first-token` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-t…
- `developer-guide/x402/x402-atlantic-testnet` _(says 688689)_ — https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet
  > …evmScheme.registerMoneyParser(async (amount: number, network: string) => { if (network === "eip155:688689") { return { amount: Math.round(amount * 1e6).toString(), // Convert to integer string (e.g., 0.01 → "1…

**Reproduce.** Search the corpus for `688688`.

**Recommendation.** Pick one value, confirm it against eth_chainId, and fix every occurrence in one pass. Better: generate the chain ID into the examples from the network reference page so the two cannot drift.

### [CRITICAL] The testnet RPC URL in the quickstart actually connects

**Developer question.** Can I paste the quickstart's testnet RPC URL into Hardhat and have it connect?

**Finding.** The quickstart's testnet host testnet.dplabs-internal.com does not complete a TLS handshake. The certificate presented for testnet.dplabs-internal.com covers *.zan.top, zan.top and not testnet.dplabs-internal.com, so any HTTPS client fails with a hostname mismatch regardless of which backend serves it. atlantic.dplabs-internal.com does answer, with chain ID 688689.

**Evidence.**

- `developer-guide/hardhat/write-your-first-nft` _(testnet.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/explorer/command\_api/contrac…
- `developer-guide/hardhat/write-your-first-token` _(testnet.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …chain_name pharos chain_id 688688 rpc_endpoint https://testnet.dplabs-internal.com api_host https://api.socialscan.io/pharos-testnet/v1/explorer/command\_api/contrac…
- `developer-guide/hardhat/write-your-first-nft` _(atlantic.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command\_…
- `developer-guide/hardhat/write-your-first-token` _(atlantic.dplabs-internal.com)_ — https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
  > …chain_name pharos chain_id 688689 rpc_endpoint https://atlantic.dplabs-internal.com" api_host https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command\_…

**Reproduce.** Search the corpus for `testnet.dplabs-internal.com`.

**Recommendation.** Replace the hostname in the Foundry and Hardhat examples with the one the certificate actually covers. This is the worst class of bug for a quickstart: the error surfaces as a TLS failure in the developer's own code.

### [HIGH] Get testnet gas to deploy

**Developer question.** Where do I get Atlantic Testnet PHRS?

**Finding.** No faucet URL is published anywhere in the corpus. "faucet" appears once, always as prose instructing the reader to use one, never with a link or eligibility rule. The page a developer lands on, Get PROS Gas, covers mainnet acquisition through fiat on-ramps (Halliday, Alchemy Pay, TopNod) — it does not mention a faucet at all.

**Evidence.**

- `tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide` — https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide
  > …**Chain ID:** `688689` **Symbol:** `PHRS` Get testnet PHRS from the Pharos faucet or directly from the team. Export your private key — you will need it when deploying > ⚠️ **Security Wa…

**Reproduce.** Search the corpus for `faucet`.

**Recommendation.** Publish the faucet URL, its rate limit, and any address or balance requirement on the Atlantic Testnet page next to the RPC details. Testnet gas is the first thing that blocks a deploy.

### [MEDIUM] The Foundry guide teaches Foundry

**Developer question.** I opened the Foundry guide — where is forge?

**Finding.** The page titled "Foundry" contains no Foundry content: zero mentions of forge, zero of Solidity. Its sections are "Write Your First Transaction", "Prerequisites", "Setup 1: Pick Your Favorite Contract Develop Framework and IDE", "Setup 2: Set Up the Project" — it is the ethers.js / web3.js transaction tutorial. Real forge commands exist, but under 6 deeper pages (write-your-first-dapp, write-your-first-nft, write-your-first-token), so a developer following the nav hierarchy concludes Foundry is unsupported.

**Evidence.**

- `developer-guide/foundry` — https://docs.pharos.xyz/developer-guide/foundry
  > Foundry / Write Your First Transaction / Prerequisites / Setup 1: Pick Your Favorite Contract Develop Framework and IDE / Setup 2: Set Up the Project / Step 3: Run the Script / Key Points / Troubleshooting / Conclusion
- `developer-guide/foundry/write-your-first-dapp` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-dapp
  > …3: Deploy the Smart Contract Set the private key: export PRIVATE_KEY=<your private key> Then cd contract forge install OpenZeppelin/openzeppelin-contracts --no-git forge script script/Counter.s.sol:CounterScript --r…
- `developer-guide/foundry/write-your-first-nft` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-nft
  > …Install OpenZeppelin Contracts: Foundry uses forge to manage dependencies. Install OpenZeppelin contracts: forge install OpenZeppelin/openzeppelin-contracts --no-git ### Setup 3: Write the NFT Contract Create a New So…
- `developer-guide/foundry/write-your-first-token` — https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
  > …Install OpenZeppelin Contracts: Foundry uses forge to manage dependencies. Install OpenZeppelin contracts: forge install OpenZeppelin/openzeppelin-contracts --no-git ### Setup 3: Write the Token Contract Create a New …

**Reproduce.** Search the corpus for `developer-guide/foundry`.

**Recommendation.** Either retitle this page to what it is (Send a Transaction with ethers.js) and add a real Foundry landing page, or move the forge deploy/verify content up to it. A section titled Foundry that never says forge is worse than a missing page.

### [HIGH] Submit a UserOperation: bundler and paymaster

**Developer question.** Where is the public bundler RPC and the paymaster for ERC-4337 on Pharos?

**Finding.** Account abstraction is name-dropped 9 times and the EntryPoint contract addresses are published (v0.6 and v0.7, on both networks), but the words "bundler" and "paymaster" appear zero times in all 74 pages. Knowing the EntryPoint address is not enough to submit a UserOperation: you need a bundler endpoint that accepts it, and without a paymaster the account must still hold PROS for gas. The docs describe the destination and omit the transport.

**Evidence.**

- `getting-started/canonical-contracts` — https://docs.pharos.xyz/getting-started/canonical-contracts
  > …Permit2 Next-generation token approval system 0x000000000022D473030F116dDEE9F6B43aC78BA3 EntryPoint (v0.7.0) ERC-4337 entry point for account abstraction 0x0000000071727De22E5E9d8BAf0edAc6f37da032 Se…

**Reproduce.** Search the corpus for `bundler paymaster`.

**Recommendation.** Add an ERC-4337 page: bundler RPC URL(s) with their rate limits, a minimal UserOperation example against the published EntryPoint, and whether any paymaster is available on Atlantic. Link it from the canonical contracts table where the EntryPoint is already listed.

### [MEDIUM] Index contract events with Goldsky

**Developer question.** How do I create a subgraph for my contract on Pharos?

**Finding.** The Goldsky page is 2453 characters of positioning: 7 headings, 1 outbound link(s) to goldsky.com, and no endpoint, no API-key or login step, and no config example. The provider list names Goldsky as the only indexing option, so this page is the entire indexing story on Pharos, and it ends where the work starts.

**Evidence.**

- `tooling-and-infrastructure/indexing/goldsky` — https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky
  > # Goldsky Goldsky is a high-performance data indexing provider that makes it easy to extract, transform, and load on-chain data to power both application and analytics use cases. ## Indexing Pharos with Goldsky Goldsky is Web3’s realtime da

**Reproduce.** Search the corpus for `goldsky`.

**Recommendation.** Add the Pharos network entry for the Goldsky CLI, an API-key step, and a minimal subgraph.yaml plus a query example against a deployed Pharos subgraph. Even a link straight to the Pharos-specific Goldsky quickstart would unblock this.

## Not gaps (2)

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
