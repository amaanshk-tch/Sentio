
import { SOROBAN_RPC_URL as DEFAULT_RPC_URL } from "../config.js";

let _reqId = 0;
function nextId() { return ++_reqId; }

const RPC_MAX_BYTES = 5 * 1024 * 1024;

export async function rpcCall(method, params = {}, { signal, rpcUrl } = {}) {
  const url = rpcUrl || DEFAULT_RPC_URL;
  const body = JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params });
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const err = new Error(`RPC HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  if (contentLength > RPC_MAX_BYTES) {
    throw new Error(`RPC response too large: ${contentLength} bytes`);
  }

  const text = await res.text();
  if (text.length > RPC_MAX_BYTES) {
    throw new Error(`RPC response body too large`);
  }

  const json = JSON.parse(text);
  if (json.error) {
    const err = new Error(json.error.message || "RPC error");
    err.code = json.error.code;
    throw err;
  }
  return json.result;
}

export async function getLatestLedger({ signal, rpcUrl } = {}) {
  return rpcCall("getLatestLedger", {}, { signal, rpcUrl });
}

export async function getTransactions(startLedger, { signal, limit = 200, rpcUrl } = {}) {
  const result = await rpcCall(
    "getTransactions",
    { startLedger, pagination: { limit } },
    { signal, rpcUrl }
  );
  return result?.transactions ?? [];
}

export async function getEvents(startLedger, contractId, { signal, limit = 100, rpcUrl } = {}) {
  const result = await rpcCall(
    "getEvents",
    {
      startLedger,
      filters: [{ contractIds: [contractId] }],
      pagination: { limit },
    },
    { signal, rpcUrl }
  );
  return result?.events ?? [];
}
