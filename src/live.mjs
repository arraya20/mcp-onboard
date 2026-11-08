// Live verifiers. Node-only — this file is never served to the browser.
//
// Each check answers one question about the real world: does this documented
// endpoint still work, and what does the chain actually say? The result is a
// snapshot that gets pinned into the report, so a reader knows the exact moment
// the claim was true. Nothing here retries its way to a nicer answer: a failure
// is recorded as a failure with its reason.

import { connect as tlsConnect } from "node:tls";

const TIMEOUT_MS = 20_000;

async function rpcChainId(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
    const body = await res.json();
    if (body.error) return { ok: false, url, error: `JSON-RPC error: ${body.error.message}` };
    if (!body.result) return { ok: false, url, error: "no result field" };
    return { ok: true, url, chainId: parseInt(body.result, 16), chainIdHex: body.result };
  } catch (err) {
    return { ok: false, url, error: describeFetchError(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Node reports TLS failures as "fetch failed" with the real reason nested. */
function describeFetchError(err) {
  const seen = new Set();
  let cur = err;
  let deepest = err;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    deepest = cur;
    cur = cur.cause;
  }
  const code = deepest?.code || err?.code;
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID") return "TLS certificate does not match the hostname (ERR_TLS_CERT_ALTNAME_INVALID)";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `DNS does not resolve (${code})`;
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ABORT_ERR" || err?.name === "AbortError") return `timed out after ${TIMEOUT_MS} ms`;
  const msg = deepest?.message || err?.message || String(err);
  return code ? `${code}: ${msg}` : msg;
}

/** What names does the certificate on this host actually cover? */
function peerCertNames(host) {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      { host, port: 443, servername: host, rejectUnauthorized: false, timeout: 12_000 },
      () => {
        const cert = socket.getPeerCertificate() || {};
        const san = (cert.subjectaltname || "")
          .split(",")
          .map((s) => s.trim().replace(/^DNS:/, ""))
          .filter(Boolean);
        socket.end();
        resolve({ names: san.length ? san : cert.subject?.CN ? [cert.subject.CN] : [], cn: cert.subject?.CN || null });
      },
    );
    socket.on("error", () => resolve({ names: [], cn: null }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ names: [], cn: null });
    });
  });
}

/**
 * Check every testnet hostname the docs use. This is the check that found the
 * quickstart bug: two hostnames are documented, one of them is not covered by
 * the certificate on any backend.
 */
async function checkTestnetHosts(hosts) {
  const results = [];
  for (const host of hosts) {
    const r = await rpcChainId(`https://${host}`);
    const cert = r.ok ? { names: [], cn: null } : await peerCertNames(host);
    results.push({ host, ...r, cert });
  }
  const working = results.filter((r) => r.ok);
  const failing = results.filter((r) => !r.ok);
  return {
    ok: failing.length === 0,
    checked: results.length,
    hosts: working.map((r) => ({ host: r.host, chainId: r.chainId })),
    failing: failing.map((r) => r.host).join(", ") || null,
    failingDetail: failing,
    // The names any failing host's certificate actually covers, deduped.
    certNames: [...new Set(failing.flatMap((r) => r.cert.names || []))],
    working: working.length ? working[0].host : null,
    workingChainId: working.length ? working[0].chainId : null,
    all: results,
  };
}

async function mcpSnapshot(documentedTools) {
  const BASE = "https://mcp.pharos.xyz";
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };

  let health = null;
  try {
    const res = await fetch(`${BASE}/health`, { headers: { accept: "application/json" } });
    health = await res.json();
  } catch (err) {
    return { ok: false, error: `health check failed: ${describeFetchError(err)}` };
  }

  const post = async (body, sid) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}/mcp`, {
        method: "POST",
        headers: sid ? { ...headers, "mcp-session-id": sid } : headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const sid2 = res.headers.get("mcp-session-id") || sid;
      const text = await res.text();
      return { res, sid: sid2, text };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "pharos-docs-gap-auditor", version: "1.0" },
      },
    });
    const sid = init.sid;

    await post({ jsonrpc: "2.0", method: "notifications/initialized" }, sid);

    const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sid);
    const payload = parseSse(list.text);
    const actual = (payload?.result?.tools || []).map((t) => t.name).sort();
    if (!actual.length) return { ok: false, error: "tools/list returned no tools" };

    const docSet = new Set(documentedTools);
    return {
      ok: true,
      healthOk: health?.status === "ok",
      healthChainId: health?.chainId ?? null,
      healthRpcUrl: health?.rpcUrl ?? null,
      actual,
      documented: [...docSet].sort(),
      toolCount: actual.length,
    };
  } catch (err) {
    return { ok: false, error: describeFetchError(err) };
  }
}

/** Streamable HTTP replies either as JSON or as an SSE frame with one data: line. */
function parseSse(text) {
  const trimmed = String(text).trim();
  if (trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { return null; }
  }
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("data:")) {
      try { return JSON.parse(line.slice(5).trim()); } catch { /* keep looking */ }
    }
  }
  return null;
}

/**
 * Take the whole snapshot. `documentedTools` comes from the corpus, so the
 * comparison is docs-against-server rather than a list typed into this file.
 */
export async function collectLiveSnapshot({ documentedTools = [] } = {}) {
  const [pacific, atlantic, testnet, mcp] = await Promise.all([
    rpcChainId("https://rpc.pharos.xyz"),
    rpcChainId("https://atlantic.dplabs-internal.com"),
    checkTestnetHosts(["testnet.dplabs-internal.com", "atlantic.dplabs-internal.com"]),
    mcpSnapshot(documentedTools),
  ]);

  return {
    source: "live",
    fetchedAt: new Date().toISOString(),
    pacific,
    atlantic,
    atlanticTls: testnet,
    mcp,
  };
}
