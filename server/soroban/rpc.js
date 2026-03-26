
const RPC_URL = process.env.STELLAR_RPC_URL || "https://mainnet.stellar.validationcloud.io/v1/XCf7xhCOYnDkWBbLKPiPfg==";

let _reqId = 0;
function nextId() { return ++_reqId; }

export async function rpcCall(method, params = {}, { signal } = {}) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params });
  const res  = await fetch(RPC_URL, {
    method:  "POST",
    signal,
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const err = new Error(`RPC HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || "RPC error");
    err.code  = json.error.code;
    throw err;
  }
  return json.result;
}

export async function getLatestLedger({ signal } = {}) {
  return rpcCall("getLatestLedger", {}, { signal });
}

export async function getLedgerEntries(keys, { signal } = {}) {
  const result = await rpcCall("getLedgerEntries", { keys }, { signal });
  return result?.entries ?? [];
}

export async function getTransactions(startLedger, { signal, limit = 200 } = {}) {
  const result = await rpcCall(
    "getTransactions",
    { startLedger, pagination: { limit } },
    { signal }
  );
  return result?.transactions ?? [];
}

export async function getEvents(startLedger, contractId, { signal, limit = 100 } = {}) {
  const result = await rpcCall(
    "getEvents",
    {
      startLedger,
      filters: [{ type: "contract", contractIds: [contractId] }],
      pagination: { limit },
    },
    { signal }
  );
  return result?.events ?? [];
}

export function buildContractInstanceKey(contractId) {
  return Buffer.from(`CONTRACT_INSTANCE:${contractId}`).toString("base64");
}
