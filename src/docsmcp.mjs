// Client for the Pharos Developer Docs MCP server (GitBook-hosted).
//
//   endpoint   https://docs.pharos.xyz/~gitbook/mcp
//   transport  Streamable HTTP, replies as `text/event-stream` (one `data:` frame)
//   tools      searchDocumentation({query}), getPage({url}), askQuestion({question})
//
// Node only (it uses fetch, which Node 20+ and Workers both have, but the session
// runner that imports this writes files). Nothing here interprets an answer: it
// returns the raw tool output so the session log can quote it verbatim.

export const DOCS_MCP_URL = "https://docs.pharos.xyz/~gitbook/mcp";

const HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

/** Parse either a plain JSON body or an SSE body into the JSON-RPC message. */
export function parseRpcBody(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const frames = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!frames.length) throw new Error(`no JSON-RPC frame in response: ${trimmed.slice(0, 120)}`);
  return JSON.parse(frames[frames.length - 1]);
}

let nextId = 1;

export async function rpc(method, params, { url = DOCS_MCP_URL, timeoutMs = 60000 } = {}) {
  const id = nextId++;
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from Docs MCP: ${text.slice(0, 200)}`);
  const msg = parseRpcBody(text);
  if (msg.error) throw new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`);
  return msg.result;
}

export async function initialize(opts) {
  return rpc(
    "initialize",
    {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "docs-mcp-onboarding", version: "1.0.0" },
    },
    opts,
  );
}

export async function listTools(opts) {
  return (await rpc("tools/list", undefined, opts)).tools;
}

/** Call a tool and return its concatenated text content. */
export async function callTool(name, args, opts) {
  const result = await rpc("tools/call", { name, arguments: args }, opts);
  if (result.isError) {
    const msg = (result.content || []).map((c) => c.text).join("\n");
    throw new Error(`tool ${name} reported an error: ${msg.slice(0, 200)}`);
  }
  return (result.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n\n");
}
