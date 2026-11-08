// The onboarding journey, expressed as probes that can be answered by evidence.
//
// A probe never asserts "docs are bad". It states the question a developer
// actually asks during self-onboarding, what a resolved answer must contain, and
// then looks for that in the corpus. Every GAP carries the query that produced
// it and a recommendation; every RESOLVED carries the page and snippet that
// answered it. Nothing here is a judgement call except the severity, which is
// listed in SEVERITY_RUBRIC below so it can be argued with.
//
// `step` follows the order a developer hits these problems in, which is the
// order the report prints them in.

import { findInCorpus, countInCorpus } from "./corpus.mjs";

export const STEP_ORDER = [
  "network",
  "gas",
  "toolchain",
  "account-abstraction",
  "indexing",
  "agent-access",
];

export const SEVERITY_RUBRIC = {
  CRITICAL:
    "Following the docs as written produces a failed transaction or a failed connection. The developer cannot proceed, and the docs look correct while doing it.",
  HIGH: "The developer must leave the docs and find the answer elsewhere, or guess. The task is possible but blocked on missing information.",
  MEDIUM:
    "The developer can proceed but wastes time on a detour the docs created — wrong page title, missing example, or a link that dead-ends.",
  LOW: "Polish. Incomplete but not misleading.",
};

/** Convenience: the parts of a probe result every probe must produce. */
function verdict({ status, finding, recommendation, evidence = [], query = "", live = null, extra = {} }) {
  return { status, finding, recommendation, evidence, query, live, ...extra };
}

export const PROBES = [
  // ---------------------------------------------------------------- 1. network
  {
    id: "network-pacific-rpc",
    step: "network",
    title: "Connect to Pacific Mainnet",
    category: "Network",
    severity: "CRITICAL",
    question: "What is the Pacific Mainnet RPC URL and chain ID, and does it work?",
    expectDoc: "A copy-pasteable RPC URL, the chain ID, and the currency symbol on one page.",
    evaluate(pages, live) {
      const hits = findInCorpus(pages, "rpc.pharos.xyz", { limit: 3 });
      const documented = pages.find((p) => p.id === "getting-started/network/pacific-mainnet");
      const hasChainId = documented && /\b1672\b/.test(documented.plain);
      const chain = live?.pacific;

      const evidence = hits.map(({ id, title, url, snippet }) => ({ id, title, url, snippet }));

      if (!chain) {
        return verdict({
          status: "UNVERIFIED",
          query: "rpc.pharos.xyz",
          finding: `Documented in ${hits.length} pages with chain ID 1672 on the network page, but no live snapshot was included, so whether the endpoint still answers was not checked.`,
          recommendation: "Re-run with the live snapshot (npm run audit:live) to confirm the endpoint answers eth_chainId.",
          evidence,
        });
      }
      if (!chain.ok) {
        return verdict({
          status: "GAP",
          query: "rpc.pharos.xyz",
          finding: `The documented Pacific RPC did not answer: ${chain.error}.`,
          recommendation: "Restore the public endpoint or publish the current one.",
          evidence,
          live: chain,
        });
      }
      const matches = chain.chainId === 1672;
      return verdict({
        status: matches && hasChainId ? "RESOLVED" : "GAP",
        query: "rpc.pharos.xyz",
        finding: matches && hasChainId
          ? `Documented endpoint ${chain.url} answers eth_chainId with 0x${chain.chainId.toString(16)} = ${chain.chainId}, matching the published chain ID.`
          : `Endpoint answered chain ID ${chain.chainId} but the network page documents 1672 (chainIdPresent=${hasChainId}).`,
        recommendation: matches ? "None — this step resolves." : "Correct the published chain ID to match the live chain.",
        evidence,
        live: chain,
      });
    },
  },

  {
    id: "network-atlantic-chain-id",
    step: "network",
    title: "Atlantic Testnet chain ID is self-consistent",
    category: "Network",
    severity: "CRITICAL",
    question: "Which chain ID do I pass to --chain-id when deploying to Atlantic Testnet?",
    expectDoc: "One chain ID, used identically by the network reference page and every deploy/verify example.",
    evaluate(pages, live) {
      const right = findInCorpus(pages, "688689", { limit: 10 });
      const wrong = findInCorpus(pages, "688688", { limit: 10 });
      const evidence = [
        ...right.map(({ id, title, url, snippet }) => ({ id, title, url, snippet, note: "says 688689" })),
        ...wrong.map(({ id, title, url, snippet }) => ({ id, title, url, snippet, note: "says 688688" })),
      ];
      const truth = live?.atlantic;

      if (!wrong.length) {
        return verdict({
          status: "RESOLVED",
          query: "688688",
          finding: `Every page that states an Atlantic chain ID uses 688689 (${right.length} pages).`,
          recommendation: "None — this step resolves.",
          evidence: evidence.slice(0, 3),
        });
      }

      const contradiction = right.length > 0;
      const truthNote = truth?.ok
        ? ` The live Atlantic RPC reports ${truth.chainId}${truth.chainId === 688689 ? ", so 688689 is the correct value and 688688 is wrong" : ""}.`
        : "";

      return verdict({
        status: truth?.ok && truth.chainId === 688689 ? "GAP" : "UNVERIFIED",
        query: "688688",
        finding:
          `The docs contradict themselves. ${right.length} pages use 688689; ${wrong.length} pages use 688688 — including the deploy and verify commands.` +
          truthNote +
          " A developer copying the Foundry or Hardhat example signs for a chain that does not exist.",
        recommendation:
          "Pick one value, confirm it against eth_chainId, and fix every occurrence in one pass. Better: generate the chain ID into the examples from the network reference page so the two cannot drift.",
        evidence,
        live: truth || null,
        extra: { contradicts: contradiction, values: { documented: [688689, 688688], live: truth?.chainId ?? null } },
      });
    },
  },

  {
    id: "network-atlantic-endpoint",
    step: "network",
    title: "The testnet RPC URL in the quickstart actually connects",
    category: "Network",
    severity: "CRITICAL",
    question: "Can I paste the quickstart's testnet RPC URL into Hardhat and have it connect?",
    expectDoc: "The same reachable testnet hostname on the network page and in the framework configs.",
    evaluate(pages, live) {
      const hosts = ["testnet.dplabs-internal.com", "atlantic.dplabs-internal.com"];
      const evidence = hosts.flatMap((h) =>
        findInCorpus(pages, h, { limit: 4 }).map(({ id, title, url, snippet }) => ({ id, title, url, snippet, note: h })),
      );
      const probe = live?.atlanticTls;

      if (!probe) {
        return verdict({
          status: "UNVERIFIED",
          query: "testnet.dplabs-internal.com",
          finding: "Both hostnames are used in the docs, but no live snapshot was included, so reachability was not checked.",
          recommendation: "Re-run with the live snapshot to confirm each documented hostname answers.",
          evidence: evidence.slice(0, 4),
        });
      }
      if (probe.ok) {
        return verdict({
          status: "RESOLVED",
          query: "testnet.dplabs-internal.com",
          finding: `Every hostname used in the docs answers eth_chainId (${probe.hosts.map((h) => `${h}=${h.chainId}`).join(", ")}).`,
          recommendation: "None — this step resolves.",
          evidence: evidence.slice(0, 4),
          live: probe,
        });
      }
      return verdict({
        status: "GAP",
        query: "testnet.dplabs-internal.com",
        finding:
          `The quickstart's testnet host ${probe.failing} does not complete a TLS handshake. ` +
          `The certificate presented for ${probe.failing} covers ${probe.certNames.join(", ")} and not ${probe.failing}, so any HTTPS client fails with a hostname mismatch regardless of which backend serves it. ` +
          `${probe.working} does answer, with chain ID ${probe.workingChainId}.`,
        recommendation:
          "Replace the hostname in the Foundry and Hardhat examples with the one the certificate actually covers. This is the worst class of bug for a quickstart: the error surfaces as a TLS failure in the developer's own code.",
        evidence,
        live: probe,
      });
    },
  },

  // -------------------------------------------------------------------- 2. gas
  {
    id: "gas-testnet-faucet",
    step: "gas",
    title: "Get testnet gas to deploy",
    category: "Onboarding",
    severity: "HIGH",
    question: "Where do I get Atlantic Testnet PHRS?",
    expectDoc: "A faucet URL developers can use themselves, with any eligibility rules.",
    evaluate(pages) {
      const mentions = findInCorpus(pages, "faucet", { limit: 6 });
      const gasPage = pages.find((p) => p.id === "getting-started/get-pros-gas");
      const gasIsMainnet = gasPage ? /mainnet|Halliday|Alchemy Pay|TopNod/i.test(gasPage.plain) : false;
      const hasFaucetUrl = /faucet[^.]{0,120}https?:\/\//i.test(
        pages.map((p) => p.plain).join(" "),
      );

      const evidence = mentions.map(({ id, title, url, snippet }) => ({ id, title, url, snippet }));

      if (hasFaucetUrl) {
        return verdict({
          status: "RESOLVED",
          query: "faucet",
          finding: "A faucet URL is published where a developer can reach it.",
          recommendation: "None — this step resolves.",
          evidence,
        });
      }
      return verdict({
        status: "GAP",
        query: "faucet",
        finding:
          `No faucet URL is published anywhere in the corpus. "faucet" appears ${mentions.length === 1 ? "once" : `${mentions.length} times`}, always as prose instructing the reader to use one, never with a link or eligibility rule. ` +
          `The page a developer lands on, Get PROS Gas, covers ${gasIsMainnet ? "mainnet acquisition through fiat on-ramps (Halliday, Alchemy Pay, TopNod)" : "acquisition but not the testnet path"} — it does not mention a faucet at all.`,
        recommendation:
          "Publish the faucet URL, its rate limit, and any address or balance requirement on the Atlantic Testnet page next to the RPC details. Testnet gas is the first thing that blocks a deploy.",
        evidence,
      });
    },
  },

  // ------------------------------------------------------------- 3. toolchain
  {
    id: "toolchain-foundry-landing",
    step: "toolchain",
    title: "The Foundry guide teaches Foundry",
    category: "Toolchain",
    severity: "MEDIUM",
    question: "I opened the Foundry guide — where is forge?",
    expectDoc: "forge install, forge build, forge create, and foundry.toml on the page titled Foundry.",
    evaluate(pages) {
      const landing = pages.find((p) => p.id === "developer-guide/foundry");
      if (!landing) {
        return verdict({
          status: "UNVERIFIED",
          query: "developer-guide/foundry",
          finding: "No page with this id in the corpus.",
          recommendation: "Check whether the page moved.",
        });
      }
      const forgeOnLanding = countInCorpus([landing], /\bforge\b/i);
      const solidityOnLanding = countInCorpus([landing], /solidity/i);
      const subpages = findInCorpus(pages, /\bforge\s+(?:create|build|install|verify)\b/i, { limit: 6 });

      if (forgeOnLanding > 0) {
        return verdict({
          status: "RESOLVED",
          query: "developer-guide/foundry",
          finding: `The landing page mentions forge ${forgeOnLanding} times.`,
          recommendation: "None — this step resolves.",
          evidence: [{ id: landing.id, title: landing.title, url: landing.url, snippet: landing.headings.join(" / ") }],
        });
      }
      return verdict({
        status: "GAP",
        query: "developer-guide/foundry",
        finding:
          `The page titled "Foundry" contains no Foundry content: zero mentions of forge, zero of Solidity. Its sections are ${landing.headings
            .slice(1, 5)
            .map((h) => `"${h}"`)
            .join(", ")} — it is the ethers.js / web3.js transaction tutorial. ` +
          `Real forge commands exist, but under ${subpages.length} deeper pages (${subpages
            .slice(0, 3)
            .map((h) => h.id.replace("developer-guide/foundry/", ""))
            .join(", ")}), so a developer following the nav hierarchy concludes Foundry is unsupported.`,
        recommendation:
          "Either retitle this page to what it is (Send a Transaction with ethers.js) and add a real Foundry landing page, or move the forge deploy/verify content up to it. A section titled Foundry that never says forge is worse than a missing page.",
        evidence: [
          { id: landing.id, title: landing.title, url: landing.url, snippet: landing.headings.join(" / ") },
          ...subpages.slice(0, 3).map(({ id, title, url, snippet }) => ({ id, title, url, snippet })),
        ],
      });
    },
  },

  // -------------------------------------------------- 4. account abstraction
  {
    id: "aa-bundler-paymaster",
    step: "account-abstraction",
    title: "Submit a UserOperation: bundler and paymaster",
    category: "Account Abstraction",
    severity: "HIGH",
    question: "Where is the public bundler RPC and the paymaster for ERC-4337 on Pharos?",
    expectDoc: "A bundler endpoint that accepts eth_sendUserOperation, and a paymaster address or sponsoring policy.",
    evaluate(pages) {
      const entryPoint = pages.find((p) => p.id === "getting-started/canonical-contracts");
      const hasEntryPoint = entryPoint ? /EntryPoint/i.test(entryPoint.plain) : false;
      const bundler = countInCorpus(pages, /bundler/i);
      const paymaster = countInCorpus(pages, /paymaster/i);
      const aa = countInCorpus(pages, "4337");

      const evidence = [];
      if (entryPoint) {
        const hit = findInCorpus([entryPoint], /EntryPoint/i, { limit: 1 })[0];
        if (hit) evidence.push({ id: hit.id, title: hit.title, url: hit.url, snippet: hit.snippet });
      }

      if (bundler > 0 && paymaster > 0) {
        return verdict({
          status: "RESOLVED",
          query: "bundler paymaster",
          finding: `Bundler appears ${bundler} times and paymaster ${paymaster} times.`,
          recommendation: "None — this step resolves.",
          evidence,
        });
      }
      return verdict({
        status: "GAP",
        query: "bundler paymaster",
        finding:
          `Account abstraction is name-dropped ${aa} times and the EntryPoint contract addresses are published${hasEntryPoint ? " (v0.6 and v0.7, on both networks)" : ""}, but the words "bundler" and "paymaster" appear zero times in all ${pages.length} pages. ` +
          "Knowing the EntryPoint address is not enough to submit a UserOperation: you need a bundler endpoint that accepts it, and without a paymaster the account must still hold PROS for gas. " +
          "The docs describe the destination and omit the transport.",
        recommendation:
          "Add an ERC-4337 page: bundler RPC URL(s) with their rate limits, a minimal UserOperation example against the published EntryPoint, and whether any paymaster is available on Atlantic. Link it from the canonical contracts table where the EntryPoint is already listed.",
        evidence,
      });
    },
  },

  // ---------------------------------------------------------------- 5. indexing
  {
    id: "indexing-goldsky-quickstart",
    step: "indexing",
    title: "Index contract events with Goldsky",
    category: "Indexing",
    severity: "MEDIUM",
    question: "How do I create a subgraph for my contract on Pharos?",
    expectDoc: "A config snippet, an API key flow, and a Pharos network name to pass to the Goldsky CLI.",
    evaluate(pages) {
      const page = pages.find((p) => p.id === "tooling-and-infrastructure/indexing/goldsky");
      if (!page) {
        return verdict({
          status: "UNVERIFIED",
          query: "goldsky",
          finding: "No Goldsky page in the corpus.",
          recommendation: "Check whether the provider list changed.",
        });
      }
      const hasEndpoint = /endpoint|rpc:\s*https|api\.goldsky/i.test(page.plain);
      const hasKeyFlow = /api key|api-key|--token|login/i.test(page.plain);
      const hasConfig = /\.yaml|\.json|subgraph\.yaml|networks\.json/i.test(page.plain);
      const offsiteLinks = (page.plain.match(/https?:\/\/\S*goldsky\S*/gi) || []).length;

      if (hasEndpoint || hasKeyFlow || hasConfig) {
        return verdict({
          status: "RESOLVED",
          query: "goldsky",
          finding: `The Goldsky page includes ${[hasEndpoint && "an endpoint", hasKeyFlow && "a key flow", hasConfig && "a config example"].filter(Boolean).join(", ")}.`,
          recommendation: "None — this step resolves.",
          evidence: [{ id: page.id, title: page.title, url: page.url, snippet: page.plain.slice(0, 220) }],
        });
      }
      return verdict({
        status: "GAP",
        query: "goldsky",
        finding:
          `The Goldsky page is ${page.plain.length} characters of positioning: ${page.headings.length} headings, ${offsiteLinks} outbound link(s) to goldsky.com, and no endpoint, no API-key or login step, and no config example. ` +
          "The provider list names Goldsky as the only indexing option, so this page is the entire indexing story on Pharos, and it ends where the work starts.",
        recommendation:
          "Add the Pharos network entry for the Goldsky CLI, an API-key step, and a minimal subgraph.yaml plus a query example against a deployed Pharos subgraph. Even a link straight to the Pharos-specific Goldsky quickstart would unblock this.",
        evidence: [{ id: page.id, title: page.title, url: page.url, snippet: page.plain.slice(0, 240) }],
      });
    },
  },

  // ----------------------------------------------------------- 6. agent access
  {
    id: "agent-mcp-wire-format",
    step: "agent-access",
    title: "Connect an agent over MCP",
    category: "Agent Access",
    severity: "HIGH",
    question: "What are the MCP endpoint, transport, auth model, and available tools?",
    expectDoc: "Endpoint, transport, auth, rate limit, and a tool list that matches what the server actually exposes.",
    evaluate(pages, live) {
      const page = pages.find((p) => p.id === "tooling-and-infrastructure/mcp");
      if (!page) {
        return verdict({
          status: "UNVERIFIED",
          query: "mcp.pharos.xyz",
          finding: "No MCP page in the corpus.",
          recommendation: "Check whether the page moved.",
        });
      }
      const documented = page.plain.match(/\b(?:get|send|eth|estimate)_[a-z_]+\b/g) || [];
      const uniqueDocumented = [...new Set(documented)];
      const hasEndpoint = /https:\/\/mcp\.pharos\.xyz\/mcp/.test(page.plain);
      const hasTransport = /streamable http/i.test(page.plain);
      const hasAuth = /authentication\s*\|?\s*none|no api key/i.test(page.plain);

      const mcp = live?.mcp;
      const evidence = [
        { id: page.id, title: page.title, url: page.url, snippet: page.plain.slice(0, 240) },
      ];

      if (!mcp) {
        const ok = hasEndpoint && hasTransport && hasAuth && uniqueDocumented.length >= 10;
        return verdict({
          status: ok ? "PARTIAL" : "GAP",
          query: "mcp.pharos.xyz",
          finding:
            `Endpoint, transport and auth are documented, and ${uniqueDocumented.length} tool names appear in the page. The live tool list was not compared because no live snapshot was included.`,
          recommendation: ok
            ? "Re-run with the live snapshot to confirm the documented tools match what the server exposes."
            : "Document the endpoint, transport, and auth model.",
          evidence,
        });
      }

      const docSet = new Set(mcp.documented);
      const actSet = new Set(mcp.actual);
      const missing = [...docSet].filter((t) => !actSet.has(t));
      const undocumented = [...actSet].filter((t) => !docSet.has(t));

      if (!missing.length && !undocumented.length && mcp.healthOk) {
        return verdict({
          status: "RESOLVED",
          query: "mcp.pharos.xyz",
          finding:
            `This step resolves cleanly. All ${actSet.size} tools exposed by the live server are documented, no documented tool is missing, and the documented /health response matches the server exactly (chainId ${mcp.healthChainId}). ` +
            "The page also specifies transport, auth, rate limit, block-parameter forms, and the 1000-block cap on get_logs.",
          recommendation: "None — this is the model the other pages should follow.",
          evidence,
          live: mcp,
        });
      }
      return verdict({
        status: "GAP",
        query: "mcp.pharos.xyz",
        finding:
          `The documented tool list and the live server disagree. Documented but not exposed: ${missing.join(", ") || "none"}. Exposed but not documented: ${undocumented.join(", ") || "none"}.`,
        recommendation: "Generate the tool table from tools/list so the page cannot drift from the server.",
        evidence,
        live: mcp,
      });
    },
  },
];

/** Run every probe. `live` may be null, in which case live-dependent probes
 *  report UNVERIFIED rather than guessing. */
export function runProbes(pages, live = null) {
  const results = PROBES.map((probe) => {
    let outcome;
    try {
      outcome = probe.evaluate(pages, live);
    } catch (err) {
      outcome = verdict({
        status: "ERROR",
        finding: `Probe threw: ${err.message}`,
        recommendation: "Fix the probe; a crashed probe must not be reported as a gap.",
      });
    }
    return {
      id: probe.id,
      step: probe.step,
      title: probe.title,
      category: probe.category,
      severity: probe.severity,
      question: probe.question,
      expectDoc: probe.expectDoc,
      ...outcome,
    };
  });
  return results.sort((a, b) => {
    const s = STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step);
    return s !== 0 ? s : a.id.localeCompare(b.id);
  });
}
