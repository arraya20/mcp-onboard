# Docs MCP onboarding — session log

Task `docs-mcp-onboarding`. Goal: onboard onto Pharos using **only the Developer Docs MCP**, and log where it breaks down.

- **Server:** `https://docs.pharos.xyz/~gitbook/mcp` (docs.pharos.xyz MCP Server, v0.28.0, MCP protocol 2025-03-26)
- **Tools used:** `askQuestion`, `searchDocumentation`, `getPage` (the server also exposes `sendFeedback`, which this session did not call)
- **Run:** 2026-11-06T20:50:53.801Z → 2026-11-06T20:53:00.353Z, by `scripts/mcp-session.mjs`
- **Source of truth:** the Docs MCP only. No page was fetched any other way in this log.

Every call below shows the exact tool and arguments, and the answer is quoted verbatim. Verdicts follow a stated rule applied to that quoted answer. `data/mcp-session.json` holds the raw responses; `npm run mcp:render` rebuilds this file from it.

## Result

9 steps · 2 answered · **7 gaps** · 0 errors

| # | Step | Verdict | Severity |
| --- | --- | --- | --- |
| 1 | Which chain ID is Atlantic Testnet? | GAP | CRITICAL |
| 2 | Does the quickstart's testnet RPC connect? | GAP | CRITICAL |
| 3 | Pacific Mainnet endpoint | RESOLVED | — |
| 4 | Where do I get testnet PHRS? | GAP | HIGH |
| 5 | Where is `forge` in the Foundry guide? | GAP | MEDIUM |
| 6 | Bundler and paymaster for ERC-4337 | GAP | HIGH |
| 7 | Index my contract with Goldsky | GAP | MEDIUM |
| 8 | Connect an agent over MCP | RESOLVED | — |
| 9 | How do I find the Docs MCP itself? | GAP | LOW |

## Step-by-step log

### Step 1 — Which chain ID is Atlantic Testnet?

**Trying to:** Find the chain ID to pass to `forge verify-contract --chain-id`.

**Query** — `askQuestion` · 6.0 s

```
{"question":"What is the chain ID, RPC URL and block explorer for Pharos Atlantic Testnet?"}
```

**Answer**

> Pharos Atlantic Testnet uses:
>
> * **Chain ID:** `688689`
> * **RPC URL:** `https://atlantic.dplabs-internal.com`
> * **Block explorer:** [atlantic.pharosscan.xyz](https://atlantic.pharosscan.xyz/)
>
> See [Atlantic Testnet](/getting-started/network/atlantic-testnet).

<details><summary>10 cited sources</summary>

- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet)
- [Pharos Network Snapshots](https://docs.pharos.xyz/node-and-validator-guide/pharos-network-snapshots)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)
- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [Rapid Node Initialization](https://docs.pharos.xyz/node-and-validator-guide/rapid-node-initialization)
- [Network](https://docs.pharos.xyz/getting-started/network)
- [Alchemy RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy)
- [Validator Node Deployment](https://docs.pharos.xyz/node-and-validator-guide/validator-node-deployment)
- [Node Management](https://docs.pharos.xyz/node-and-validator-guide/node-management)

</details>

**Query** — `askQuestion` · 11.7 s

```
{"question":"Which chain ID do I pass to forge verify-contract --chain-id for Atlantic Testnet? Is 688688 a valid Pharos chain ID?"}
```

**Answer**

> Use `--chain-id 688689` for Atlantic Testnet. The [Atlantic Testnet](/getting-started/network/atlantic-testnet) list its ChainID as `688689`.
>
> `688688` is listed for a **different Pharos testnet**, not Atlantic. The Foundry guide’s Atlantic verification example uses `688688`, but that conflicts with the network details and the [Write Your First Token](/developer-guide/hardhat/write-your-first-token), which lists Atlantic as `688689`. Use `688689` for Atlantic.

<details><summary>16 cited sources</summary>

- [Cross Chain Infrastructure](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)
- [Why Pharos](https://docs.pharos.xyz/introduction/why-pharos)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)
- [Chainlink CCIP](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain/chainlink-ccip)
- [Pacific Mainnet](https://docs.pharos.xyz/getting-started/network/pacific-mainnet)
- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [Write Your First NFT](https://docs.pharos.xyz/developer-guide/foundry/write-your-first-nft)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [Write Your First Token](https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token)
- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet)
- [Node Management](https://docs.pharos.xyz/node-and-validator-guide/node-management)
- [Write Your First Token](https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token)
- [Write Your First NFT](https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft)
- [Piggy Bank Tutorial](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide)
- [Rapid Node Initialization(Testnet)](https://docs.pharos.xyz/node-and-validator-guide/rapid-node-initialization/rapid-node-initialization-testnet)

</details>

**Query** — `searchDocumentation` · 1.0 s

```
{"query":"688688"}
```

**Answer**

> Title: Write Your First NFT
> Link: https://docs.pharos.xyz/developer-guide/foundry/write-your-first-nft
> Content: For Atlantic Testnet
>
> forge verify-contract \
> <contract_address> \
> --constructor-args <abi_encoded_args> \
> src/Token.sol:Token \
> --chain-id 688688 \
> --verifier blockscout \
> --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract
>
> For Testnet
>
> forge verify-contract \
> <contract_address> \
> --constructor-args <abi_encoded_args> \
> src/Token.sol:Token \
> --chain-id 688688 \
> --verifier blockscout \
> --verifier-url https://api.socialscan.io/pharos-testnet/v1/explorer/command_api/contract
>
> Note: Replace with your token contract address
>
> Title: Write Your First Token
> Link: https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token
> Content: For Atlantic Testnet
>
> forge verify-contract \
> <contract_address> \
> --constructor-args <abi_encoded_args> \
> src/Token.sol:Token \
> --chain-id 688688 \
> --verifier blockscout \
> --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract
>
> For Testnet
>
> forge verify-contract \
> <contract_address> \
> --constructor-args <abi_encoded_args> \
> src/Token.sol:Token \
> --chain-id 688689 \
> --verifier blockscout \
> --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract
>
> Note: Replace with your token contract address
>
> Title: Write Your First Token
> Link: https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
> Content: Add the following content to your hardhat.config.js file
>
> For Atlantic Testnet
>
> chain_name
> pharos
> chain_id
> 688689
> rpc_endpoint
> https://atlantic.dplabs-internal.com"
> api_host
> https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract
> explorer_url
> https://atlantic.pharosscan.x
>
> [… 3999 more characters in data/mcp-session.json]

**Verdict: GAP (CRITICAL).** The Docs MCP answer itself says 688688 belongs to a different testnet and that some Foundry examples wrongly use it for Atlantic.

### Step 2 — Does the quickstart's testnet RPC connect?

**Trying to:** Paste the RPC URL from the Hardhat guide into `hardhat.config` and connect.

**Query** — `askQuestion` · 7.5 s

```
{"question":"What RPC URL should I put in my Hardhat config for the Pharos testnet?"}
```

**Answer**

> Use `https://atlantic.dplabs-internal.com` for the Pharos Atlantic testnet. Its chain ID is `688689`.
>
> ```js
> networks: {
>   pharosTestnet: {
>     url: "https://atlantic.dplabs-internal.com",
>     chainId: 688689,
>   },
> }
> ```
>
> See the [Atlantic Testnet](/getting-started/network/atlantic-testnet).

<details><summary>10 cited sources</summary>

- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [RPC Infrastructure](https://docs.pharos.xyz/tooling-and-infrastructure/rpc)
- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet)
- [Alchemy RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy)
- [Nirvana RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/nirvana)
- [Pacific Mainnet](https://docs.pharos.xyz/getting-started/network/pacific-mainnet)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)
- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [Pharos Testnet: Rebuild Node with Preserved Node Info](https://docs.pharos.xyz/pharos-testnet-rebuild-node-with-preserved-node-info)

</details>

**Query** — `searchDocumentation` · 1.1 s

```
{"query":"testnet.dplabs-internal.com"}
```

**Answer**

> Title: Write Your First Token
> Link: https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token
> Content: Add the following content to your hardhat.config.js file
>
> For Atlantic Testnet
>
> chain_name
> pharos
> chain_id
> 688689
> rpc_endpoint
> https://atlantic.dplabs-internal.com"
> api_host
> https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract
> explorer_url
> https://atlantic.pharosscan.xyz/
>
> require("@nomicfoundation/hardhat-toolbox");
> /** @type import('hardhat/config').HardhatUserConfig */
> module.exports = {
>   solidity: "0.8.28",
>   networks: {
>     pharos: {
>       url: "https://atlantic.dplabs-internal.com",
>       accounts: [vars.get("PRIVATE_KEY")],
>     },
>   },
>   etherscan: {
>     customChains: [
>       {
>         network: "pharos",
>         chainId: 688689,
>         urls: {
>           apiURL: "https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract",
>           browserURL: "https://atlantic.pharosscan.xyz/",
>         },
>       },
>     ],
>     apiKey: {
>       pharos: "Put a random string", // Note we don't need a apiKey here, just leave a random string
>     },
>   }
> };
>
> For Testnet
>
> chain_name
> pharos
> chain_id
> 688688
> rpc_endpoint
> https://testnet.dplabs-internal.com
> api_host
> https://api.socialscan.io/pharos-testnet/v1/explorer/command_api/contract
> explorer_url
> https://testnet.pharosscan.xyz/
>
> require("@nomicfoundation/hardhat-toolbox");
> /** @type import('hardhat/config').HardhatUserConfig */
> module.exports = {
>   solidity: "0.8.28",
>   networks: {
>     pharos: {
>       url: "https://testnet.dplabs-internal.com",
>       accounts: [vars.get("PRIVATE_KEY")],
>     },
>   },
>   etherscan: {
>     customChains: [
>       {
>         network: "pharos",
>         chainId: 688688, // Or use Pharos Atlantic Testnet chain id 688689
>         urls: {
>           api
>
> [… 11551 more characters in data/mcp-session.json]

**Verdict: GAP (CRITICAL).** The assistant answers correctly (atlantic.dplabs-internal.com), but the pages a developer actually copies from still contain testnet.dplabs-internal.com. TLS for that host is checked separately in the live audit (certificate for *.zan.top).

### Step 3 — Pacific Mainnet endpoint

**Trying to:** Connect to mainnet.

**Query** — `askQuestion` · 6.7 s

```
{"question":"What is the Pacific mainnet RPC URL and chain ID?"}
```

**Answer**

> Pacific mainnet uses:
>
> * **RPC URL:** `https://rpc.pharos.xyz`
> * **Chain ID:** `1672`
>
> See [Pacific Mainnet](/getting-started/network/pacific-mainnet).

<details><summary>10 cited sources</summary>

- [Pacific Mainnet](https://docs.pharos.xyz/getting-started/network/pacific-mainnet)
- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet)
- [x402 Pacific Mainnet](https://docs.pharos.xyz/developer-guide/x402/x402-pacific-mainnet)
- [Node Management](https://docs.pharos.xyz/node-and-validator-guide/node-management)
- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [RPC Infrastructure](https://docs.pharos.xyz/tooling-and-infrastructure/rpc)
- [Cross Chain Infrastructure](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain)
- [Alchemy RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy)
- [Nirvana RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/nirvana)
- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)

</details>

**Verdict: RESOLVED.** Answer gives https://rpc.pharos.xyz and chain ID 1672 (verified against the chain in the live audit).

### Step 4 — Where do I get testnet PHRS?

**Trying to:** Fund a wallet so I can pay gas for a deploy.

**Query** — `askQuestion` · 14.4 s

```
{"question":"Where do I get Atlantic testnet PHRS from a faucet? Give the URL."}
```

**Answer**

> I can’t find a faucet URL in the docs. They say to get Atlantic testnet PHRS from the Pharos faucet or directly from the team. See [Atlantic Testnet](/getting-started/network/atlantic-testnet) for network details.

<details><summary>14 cited sources</summary>

- [Token Registry](https://docs.pharos.xyz/getting-started/token-registry)
- [Atlantic Testnet](https://docs.pharos.xyz/getting-started/network/atlantic-testnet)
- [Piggy Bank Tutorial](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [Pharos Network Snapshots](https://docs.pharos.xyz/node-and-validator-guide/pharos-network-snapshots)
- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [Network](https://docs.pharos.xyz/getting-started/network)
- [Write Your First Token](https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-token)
- [Alchemy RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy)
- [Node Management](https://docs.pharos.xyz/node-and-validator-guide/node-management)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)
- [Pharos Testnet: Rebuild Node with Preserved Node Info](https://docs.pharos.xyz/pharos-testnet-rebuild-node-with-preserved-node-info)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)

</details>

**Query** — `searchDocumentation` · 0.9 s

```
{"query":"faucet"}
```

**Answer**

> Title: Piggy Bank Tutorial
> Link: https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide
> Content: Create an EVM-compatible wallet (MetaMask or any EVM wallet)
> Add the Pharos Atlantic Testnet to your wallet:
> Network Name: Pharos Atlantic Testnet
> RPC URL: https://atlantic.dplabs-internal.com
> Chain ID: 688689
> Symbol: PHRS
> Get testnet PHRS from the Pharos faucet or directly from the team.
> Export your private key — you will need it when deploying
>
> ⚠️ Security Warning: Never share your private key. Never commit it to git. Always use the $PRIVATE_KEYenvironment variable — never paste it directly into commands you share with others.

**Verdict: GAP (HIGH).** Neither the answer nor the search results contain a URL for a faucet. The assistant says the docs name a faucet without linking it.

### Step 5 — Where is `forge` in the Foundry guide?

**Trying to:** Follow the Foundry guide to compile and deploy a Solidity contract.

**Query** — `getPage` · 0.4 s

```
{"url":"https://docs.pharos.xyz/developer-guide/foundry"}
```

**Answer**

> # Foundry
>
> This guide is suitable for developers who want to start building dApps using Pharos and Foundry toolchains. If you are a new user of Ethereum, please consider researching the [Ethereum documentation](https://ethereum.org/en/developers/docs/) before continuing.
>
> ## Write Your First Transaction
>
> This guide will walk you through the process of sending your first transaction on the Pharos blockchain using three popular libraries: `ethers.js`, `web3.js`, and `web3.py`. By the end of this guide, you will understand how to send a transaction programmatically using these libraries.
>
> ### Prerequisites
>
> Before you begin, ensure you have the following:
>
> * Git: Used for code management and obtain examples.
> * Pharos Devnet/Testnet Access: Access to a Pharos node (local or remote) for interacting with the blockchain.
>
> ### Setup 1: Pick Your Favorite Contract Develop Framework and IDE
>
> Install your preferred contract framework from the below list:
>
> * ethers.js
> * web3.js
> * web3.py
>
> ### Setup 2: Set Up the Project
>
> Clone the example repo and add dependencies.
>
> ```sh
> git clone https://github.com/PharosNetwork/examples
> cd examples/transaction/ethersjs
> npm install
> ```
>
> ```javascript
> const { ethers } = require("ethers");
>
> // Connect to Pharos Testnet
> const provider = new ethers.providers.JsonRpcProvider("<PHAROS_RPC_URL>");
>
> // Note: Your wallet private key (for testnet only, never expose this in production)
> const privateKey = "YOUR_PRIVATE_KEY";
> const wallet = new ethers.Wallet(privateKey, provider);
>
> // Transaction details
> const tx = {
>     to: "RECIPIENT_ADDRESS", // Note: Replace with the recipient's address
>     value: ethers.utils.parseEther("0.1"), // Amount to send (0.1 PHAR)
> };
>
> // Send the transaction
> wallet.sendTransaction(tx)
>     .then((transaction) => {
>         console
>
> [… 1238 more characters in data/mcp-session.json]

**Query** — `searchDocumentation` · 0.7 s

```
{"query":"forge script deploy Atlantic"}
```

**Answer**

> Title: Pharos Skill Engine
> Link: https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide
> Content: # 1. Pre-checks
> cast wallet address --private-key $PRIVATE_KEY
> cast balance $DEPLOYER --rpc-url $RPC --ether
> # 2. Run the deploy script
> forge script script/DeployMyContract.s.sol:DeployMyContract \
>   --rpc-url $RPC \
>   --private-key $PRIVATE_KEY \
>   --broadcast
> # 3. Wait 10 seconds, then verify
> sleep 10
> forge verify-contract <contract_address> src/MyContract.sol:MyContract \
>   --chain-id 688689 \
>   --verifier-url https://api.socialscan.io/pharos-atlantic-testnet/v1/explorer/command_api/contract \
>   --verifier blockscout
>
> Title: Piggy Bank Tutorial
> Link: https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide
> Content: Paste this entire block into references/vault.md:
>
> **# Vault Operation Instructions**
> This file contains detailed instructions for deploying and interacting with the
> SimpleVault (Piggy Bank) contract on Pharos. It teaches three key concepts:
> sending native tokens with `--value`, using `block.timestamp` for time locks,
> and querying on-chain events.
> > **Network Configuration**: The `<rpc>` parameter in all commands is read from
> > the corresponding network's `rpcUrl` field in `assets/networks.json`.
> > Defaults to the Atlantic testnet.
> >
> > **Private Key Configuration**: All write operations must explicitly pass the
> > private key via the `--private-key` parameter.
> > Recommended: `--private-key $PRIVATE_KEY`.
> ---
> **## Deploy SimpleVault**
> **### Overview**
> SimpleVault is a piggy bank contract. The deployer sets a time lock duration in
> seconds at deployment. PHRS deposited into the vault cannot be withdrawn until
> the lock expires.
> **### Step 1: Generate Deployment Script**
> The Agent generates `script/Deplo
>
> [… 15050 more characters in data/mcp-session.json]

**Verdict: GAP (MEDIUM).** The page titled 'Foundry' (fetched with getPage) never says `forge`.

### Step 6 — Bundler and paymaster for ERC-4337

**Trying to:** Send a UserOperation using the published EntryPoint.

**Query** — `askQuestion` · 16.5 s

```
{"question":"Is there a public ERC-4337 bundler RPC and a paymaster on Pharos?"}
```

**Answer**

> The docs **do not list a public ERC-4337 bundler RPC or hosted paymaster for Pharos**.
>
> They do list ERC-4337 EntryPoint contracts: Pacific Mainnet has v0.7 and v0.6; Atlantic Testnet lists v0.7. A deployed EntryPoint is not itself a bundler or paymaster. See [Canonical Contracts](/getting-started/canonical-contracts).
>
> Pharos’s public RPC, `https://rpc.pharos.xyz`, is documented as a general chain RPC, not an ERC-4337 bundler endpoint. The [JSON-RPC API Methods](/api-and-sdk/json-rpc-methods) list standard methods, but not bundler methods.

<details><summary>16 cited sources</summary>

- [Canonical Contracts](https://docs.pharos.xyz/getting-started/canonical-contracts)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)
- [x402 Pacific Mainnet](https://docs.pharos.xyz/developer-guide/x402/x402-pacific-mainnet)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [Piggy Bank Tutorial](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide)
- [Fordefi](https://docs.pharos.xyz/tooling-and-infrastructure/wallets/fordefi)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [Foundry](https://docs.pharos.xyz/developer-guide/foundry)
- [Node Configuration](https://docs.pharos.xyz/node-and-validator-guide/validator-node-deployment/node-configuration)
- [JSON-RPC API Methods](https://docs.pharos.xyz/api-and-sdk/json-rpc-methods)
- [RPC Infrastructure](https://docs.pharos.xyz/tooling-and-infrastructure/rpc)
- [Nirvana RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/nirvana)
- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [Call EVM From WASM](https://docs.pharos.xyz/developer-guide/interoperability/call-evm-from-wasm)

</details>

**Query** — `searchDocumentation` · 1.1 s

```
{"query":"bundler paymaster UserOperation"}
```

**Answer**

> Title: Canonical Contracts
> Link: https://docs.pharos.xyz/getting-started/canonical-contracts
> Content: Create2Deployer
> Helper for CREATE2 opcode usage
> 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2
> Foundry Deterministic Deploy
> Integrated with Foundry for deterministic deployments
> 0x4e59b44847b379578588920ca78fbf26c0b4956c
> MultiCall3
> Allows bundling multiple transactions
> 0xcA11bde05977b3631167028862bE2a173976CA11
> GnosisSafe (v1.3.0)
> Multisignature wallet
> 0x69f4D1788e39c87893C980c06EdF4b7f686e2938
> GnosisSafeL2 (v1.3.0)
> Events-based implementation of GnosisSafe
> 0xfb1bffC9d739B8D520DaF37dF666da4C687191EA
> SafeSingletonFactory
> Safe's deterministic deployment proxy
> 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7
> CreateX
> Advanced cross-chain deployment factory supporting CREATE, CREATE2, and CREATE3
> 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
> MultiSendCallOnly (v1.3.0)
> Batches multiple transactions (calls only)
> 0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B
> MultiSend (v1.3.0)
> Batches multiple transactions
> 0x998739BFdAAdde7C933B942a68053933098f9EDa
> Permit2
> Next-generation token approval system
> 0x000000000022D473030F116dDEE9F6B43aC78BA3
> ERC-4337 EntryPoint (v0.7)
> ERC-4337 entry point for account abstraction
> 0x0000000071727De22E5E9d8BAf0edAc6f37da032
> ERC-4337 SenderCreator (v0.7)
> Helper for EntryPoint
> 0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C
> ERC-4337 EntryPoint (v0.6)
> Account abstraction entry point (v0.6); validates and executes UserOperations
> 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
> ERC-4337 SenderCreator (v0.6)
> Helper contract used by EntryPoint v0.6 to deploy smart accounts via initCode
> 0x7fc98430eAEdbb6070B35B39D798725049088348

**Verdict: GAP (HIGH).** searchDocumentation for 'bundler paymaster UserOperation' returns pages that never contain either word (only the EntryPoint address).

### Step 7 — Index my contract with Goldsky

**Trying to:** Get a subgraph indexing the contract I deployed.

**Query** — `getPage` · 0.5 s

```
{"url":"https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky"}
```

**Answer**

> # Goldsky
>
> Goldsky is a high-performance data indexing provider that makes it easy to extract, transform, and load on-chain data to power both application and analytics use cases.
>
> ## Indexing Pharos with Goldsky
>
> Goldsky is Web3’s realtime data platform, giving developers access to world-class data infrastructure to power their onchain applications.
>
> Seamlessly access the data you need with lightning-fast indexing, resilient subgraphs, and flexible data streaming pipelines. Spend less time on the complexities of infra maintenance and more time building incredible user experiences.
>
> ### Why Goldsky?
>
> * **Scalable Infrastructure**: Scalable and resilient infrastructure, handling data challenges as your application grows.
> * **Developer-Friendly Tools**: Easily integrate and iterate without being slowed down by complex data engineering.
> * Enterprise Support: The Goldsky team is available 24/7 to help if things go wrong.
>
> ### Goldsky Products
>
> #### Subgraphs
>
> **Subgraphs** let you efficiently access blockchain data relevant to your application.
>
> * **Fast Queries**: Optimized infrastructure means faster query responses and better performance.
> * **Flexible Integration**: Customize your queries and adapt indexing to suit your application's unique needs.
> * **Tagging & Organization**: Use tagging to organize your data, making it easier to manage and access.
>
> **Use Cases**: dApps, NFT marketplaces, gaming, DAOs – any scenario where you need reliable, real-time blockchain data.
>
> #### Mirror
>
> **Mirror** gives you full control over your blockchain data. Instead of just querying, you can stream onchain data directly into your own database.
>
> * **Realtime Streaming**: Stream onchain data directly to your existing systems, enabling fast and interactive user experiences.
> * **Custom Data
>
> [… 688 more characters in data/mcp-session.json]

**Query** — `askQuestion` · 12.5 s

```
{"question":"How do I index my contract events with a subgraph on Pharos using Goldsky?"}
```

**Answer**

> Goldsky is the documented Pharos provider for indexing contract events with subgraphs. The Pharos guide links to Goldsky’s [Pharos documentation](https://goldsky.com/chains/pharos/?utm_source=pharos\&utm_medium=docs) for setup instructions.
>
> Subgraphs let you index the on-chain data your app needs and query it efficiently. For the Pharos-specific workflow — including the manifest, deployment commands, and network configuration — follow Goldsky’s guide. The Pharos docs don’t include those implementation details. See the [Goldsky](/tooling-and-infrastructure/indexing/goldsky) and [Indexer](/tooling-and-infrastructure/indexing).

<details><summary>10 cited sources</summary>

- [Goldsky](https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky)
- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [Canonical Contracts](https://docs.pharos.xyz/getting-started/canonical-contracts)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [Write Your First Uniswap Contract](https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-uniswap-contract)
- [Write Your First Uniswap Contract](https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)
- [Piggy Bank Tutorial](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide/piggybank-skill-guide)
- [Indexer](https://docs.pharos.xyz/tooling-and-infrastructure/indexing)
- [Circle CCTP](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain/circle-cctp)

</details>

**Verdict: GAP (MEDIUM).** The Goldsky page (2488 chars as returned by getPage, markup included; the audit's plain-text count is smaller) has no CLI command, API-key step, subgraph config or query example.

### Step 8 — Connect an agent over MCP

**Trying to:** Let an AI agent read the chain.

**Query** — `askQuestion` · 20.2 s

```
{"question":"How do I connect an AI agent to Pharos over MCP? Endpoint, transport, auth, tools?"}
```

**Answer**

> Connect to the hosted server with **Streamable HTTP**:
>
> ```json
> {
>   "mcpServers": {
>     "pharos": {
>       "type": "http",
>       "url": "https://mcp.pharos.xyz/mcp"
>     }
>   }
> }
> ```
>
> * **Endpoint:** `https://mcp.pharos.xyz/mcp`
> * **Authentication:** None; it’s public. The hosted service is limited to **120 requests per minute per IP**.
> * **Chain:** Pharos, ID `1672` (`0x688`); native token `PROS`.
> * **Tools:** `get_chain_info`, `get_block_number`, `get_block`, `get_gas_price`, `get_balance`, `get_transaction_count`, `get_transaction`, `get_transaction_receipt`, `eth_call`, `estimate_gas`, `get_code`, `get_storage_at`, `get_logs`, and `send_raw_transaction`.
>
> For a client that only supports **stdio**, bridge it to the hosted endpoint:
>
> ```json
> {
>   "mcpServers": {
>     "pharos": {
>       "command": "npx",
>       "args": ["-y", "mcp-remote", "https://mcp.pharos.xyz/mcp"]
>     }
>   }
> }
> ```
>
> The server does not handle private keys. Sign transactions locally, then pass the signed transaction bytes to `send_raw_transaction`. See [Pharos MCP](/tooling-and-infrastructure/mcp) for tool details, self-hosting, and troubleshooting.

<details><summary>10 cited sources</summary>

- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [About Pharos](https://docs.pharos.xyz/introduction/readme)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)
- [Pharos Node Monitoring](https://docs.pharos.xyz/pharos-node-monitoring)
- [Fordefi](https://docs.pharos.xyz/tooling-and-infrastructure/wallets/fordefi)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [x402 Pacific Mainnet](https://docs.pharos.xyz/developer-guide/x402/x402-pacific-mainnet)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [Vision & Mission](https://docs.pharos.xyz/introduction/vision-and-mission)
- [Why Pharos](https://docs.pharos.xyz/introduction/why-pharos)

</details>

**Verdict: RESOLVED.** Answer names the endpoint and transport (the chain MCP page is verified tool-by-tool in the live audit).

### Step 9 — How do I find the Docs MCP itself?

**Trying to:** Start from the docs and learn that a Developer Docs MCP exists and where it lives.

**Query** — `searchDocumentation` · 1.0 s

```
{"query":"docs MCP server endpoint ~gitbook/mcp"}
```

**Answer**

> Title: Pharos MCP
> Link: https://docs.pharos.xyz/tooling-and-infrastructure/mcp
> Content: Some clients cannot connect to remote MCP servers directly. Bridge to the hosted endpoint with mcp-remote:
>
> {
>   "mcpServers": {
>     "pharos": {
>       "command": "npx",
>       "args": ["-y", "mcp-remote", "https://mcp.pharos.xyz/mcp"]
>     }
>   }
> }
>
> Title: Circle CCTP
> Link: https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain/circle-cctp
> Content: CCTP endpoints enable advanced capabilities such as fetching attestations for Standard Transfer or Fast Transfer burn events, verifying public keys across versions, accessing transaction details, querying fast transfer allowances and fees, and initiating re-attestation processes. Below is an overview of the CCTP public endpoints. Click on any endpoint for its API reference.
>
> GET /v2/publicKeys
> Returns public keys for validating attestations across all supported CCTP versions.
> Retrieve public keys to verify attestation authenticity for crosschain transactions.
> GET /v2/messages
> Retrieves messages and attestations for a given transaction or nonce, supporting messages for all CCTP versions.
> Fetch attestation status and transaction details.
> POST /v2/reattest
> Re-attests a soft finality V2 message to achieve finality or revive expired Fast Transfer burns.
> Handle edge cases requiring updated attestations or finalize transactions with stricter rules.
> GET /v2/fastBurn/USDC/allowance
> Retrieves the current USDC Fast Transfer allowance remaining.
> Monitor available allowance for Fast Transfer burns in real-time.
> GET /v2/burn/USDC/fees
> Returns the fees for USDC transfers between specified source and destination domains.
> Calculate transaction costs before initiating a Fast or Standard Transfer.
>
> Deprecated endpoint
> The endpoint /v2/fastBurn/USDC/fees
>
> [… 9148 more characters in data/mcp-session.json]

**Query** — `askQuestion` · 23.4 s

```
{"question":"Is there a documentation MCP server for docs.pharos.xyz, and what is its URL?"}
```

**Answer**

> Yes. The [Pharos MCP](/tooling-and-infrastructure/mcp) server is at **<https://mcp.pharos.xyz/mcp>**. It provides Pharos chain data and on-chain operations; the docs do not describe it as a documentation-search server.

<details><summary>10 cited sources</summary>

- [Pharos MCP](https://docs.pharos.xyz/tooling-and-infrastructure/mcp)
- [x402 Atlantic Testnet](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet)
- [x402 Pacific Mainnet](https://docs.pharos.xyz/developer-guide/x402/x402-pacific-mainnet)
- [Chainlink CCIP](https://docs.pharos.xyz/tooling-and-infrastructure/cross-chain/chainlink-ccip)
- [Supra](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/supra)
- [Chainlink Data Feeds](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-ds)
- [ZAN RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan)
- [Alchemy RPC](https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy)
- [Pharos Skill Engine](https://docs.pharos.xyz/tooling-and-infrastructure/pharos-skill-engine-guide)
- [Node Debugging & Configuration](https://docs.pharos.xyz/node-and-validator-guide/node-debugging-and-configuration)

</details>

**Verdict: GAP (LOW).** Neither the search nor the answer contains the Docs MCP URL; only the chain MCP (mcp.pharos.xyz) is documented.

## Gaps and suggested fixes

### Gap 1 — [CRITICAL] Which chain ID is Atlantic Testnet?

**Exact query:** `askQuestion` `{"question":"What is the chain ID, RPC URL and block explorer for Pharos Atlantic Testnet?"}` · `askQuestion` `{"question":"Which chain ID do I pass to forge verify-contract --chain-id for Atlantic Testnet? Is 688688 a valid Pharos chain ID?"}` · `searchDocumentation` `{"query":"688688"}`

**What broke:** The Docs MCP answer itself says 688688 belongs to a different testnet and that some Foundry examples wrongly use it for Atlantic.

**What the docs should say:** Use 688689 in every Atlantic example (Foundry `forge verify-contract` on write-your-first-nft and write-your-first-token, Hardhat `chain_id`). If a second 'Testnet' (688688) is real, give it its own page under getting-started/network/ with RPC, explorer and status, or remove it.

### Gap 2 — [CRITICAL] Does the quickstart's testnet RPC connect?

**Exact query:** `askQuestion` `{"question":"What RPC URL should I put in my Hardhat config for the Pharos testnet?"}` · `searchDocumentation` `{"query":"testnet.dplabs-internal.com"}`

**What broke:** The assistant answers correctly (atlantic.dplabs-internal.com), but the pages a developer actually copies from still contain testnet.dplabs-internal.com. TLS for that host is checked separately in the live audit (certificate for *.zan.top).

**What the docs should say:** Replace testnet.dplabs-internal.com with atlantic.dplabs-internal.com in the Hardhat guides (or fix the certificate), and retire testnet.pharosscan.xyz (expired certificate) in favour of atlantic.pharosscan.xyz.

### Gap 3 — [HIGH] Where do I get testnet PHRS?

**Exact query:** `askQuestion` `{"question":"Where do I get Atlantic testnet PHRS from a faucet? Give the URL."}` · `searchDocumentation` `{"query":"faucet"}`

**What broke:** Neither the answer nor the search results contain a URL for a faucet. The assistant says the docs name a faucet without linking it.

**What the docs should say:** On the Atlantic Testnet page, next to the RPC details, publish the faucet URL, its per-address limit and any eligibility rule. Remove 'or directly from the team' unless there is a way to reach the team.

### Gap 4 — [MEDIUM] Where is `forge` in the Foundry guide?

**Exact query:** `getPage` `{"url":"https://docs.pharos.xyz/developer-guide/foundry"}` · `searchDocumentation` `{"query":"forge script deploy Atlantic"}`

**What broke:** The page titled 'Foundry' (fetched with getPage) never says `forge`.

**What the docs should say:** Retitle the page to what it is (send a transaction with ethers.js) and add a real Foundry landing page: `forge init`, `forge create`/`forge script` against Atlantic, `forge verify-contract` with the correct chain ID. Or move that content up from write-your-first-*.

### Gap 5 — [HIGH] Bundler and paymaster for ERC-4337

**Exact query:** `askQuestion` `{"question":"Is there a public ERC-4337 bundler RPC and a paymaster on Pharos?"}` · `searchDocumentation` `{"query":"bundler paymaster UserOperation"}`

**What broke:** searchDocumentation for 'bundler paymaster UserOperation' returns pages that never contain either word (only the EntryPoint address).

**What the docs should say:** Add an ERC-4337 page: bundler RPC URL(s) and rate limits, whether a paymaster exists on Atlantic, and a minimal UserOperation against the EntryPoint already listed on Canonical Contracts.

### Gap 6 — [MEDIUM] Index my contract with Goldsky

**Exact query:** `getPage` `{"url":"https://docs.pharos.xyz/tooling-and-infrastructure/indexing/goldsky"}` · `askQuestion` `{"question":"How do I index my contract events with a subgraph on Pharos using Goldsky?"}`

**What broke:** The Goldsky page (2488 chars as returned by getPage, markup included; the audit's plain-text count is smaller) has no CLI command, API-key step, subgraph config or query example.

**What the docs should say:** Add the Pharos network name for the Goldsky CLI, the login/API-key step, a minimal subgraph.yaml and a query example, or link directly to Goldsky's Pharos quickstart.

### Gap 7 — [LOW] How do I find the Docs MCP itself?

**Exact query:** `searchDocumentation` `{"query":"docs MCP server endpoint ~gitbook/mcp"}` · `askQuestion` `{"question":"Is there a documentation MCP server for docs.pharos.xyz, and what is its URL?"}`

**What broke:** Neither the search nor the answer contains the Docs MCP URL; only the chain MCP (mcp.pharos.xyz) is documented.

**What the docs should say:** Add a short 'Use these docs from your AI client' section (docs.pharos.xyz/~gitbook/mcp, tools searchDocumentation / getPage / askQuestion, a Claude/Cursor config snippet) and link it from ai.pharos.xyz and from the chain MCP page, so the two MCP servers are not confused.

## What I managed to build or run by the end

**Ran:**

- 17 Docs MCP calls (`askQuestion`, `searchDocumentation`, `getPage`), 0 failed, 126 s of server time. Raw responses are in `data/mcp-session.json`.
- Resolved from the docs alone: **Pacific Mainnet endpoint** — Answer gives https://rpc.pharos.xyz and chain ID 1672 (verified against the chain in the live audit).
- Resolved from the docs alone: **Connect an agent over MCP** — Answer names the endpoint and transport (the chain MCP page is verified tool-by-tool in the live audit).

**Did not get to:**

- No contract was deployed and no transaction was sent from this session. The session only queries the Docs MCP; it holds no wallet.
- A first-time developer following these answers would be stopped, or sent to guess, at: step 1 (Which chain ID is Atlantic Testnet?, CRITICAL); step 2 (Does the quickstart's testnet RPC connect?, CRITICAL); step 4 (Where do I get testnet PHRS?, HIGH); step 6 (Bundler and paymaster for ERC-4337, HIGH).

**Built:**

- `scripts/mcp-session.mjs` — replays this journey against the Docs MCP, derives each verdict from the recorded answer by a stated rule, and renders this log. `npm run mcp:check` fails if this file is not exactly what the raw session renders to.
- A cross-check outside the MCP, kept separate from this log: `npm run audit:live` recounts the same journey over a pinned `docs.pharos.xyz` snapshot and probes the chain, TLS certificates and the chain MCP directly. The certificate evidence mentioned in Gaps 1 and 2 comes from that audit, not from the Docs MCP. See `reports/audit.md`.
