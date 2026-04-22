import { getLatestLedger, getTransactions, getEvents } from "./rpc.js";
import { HORIZON_URL, HORIZON_MAINNET_URL, SOROBAN_RPC_URL, SOROBAN_RPC_MAINNET_URL } from "../config.js";
import { verifyHomeDomain } from "../riskEngine.js";

const LEDGERS_PER_DAY = 5 * 60 * 24;

async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}

function detectContractType(events) {
  const topics = events.flatMap((e) =>
    Array.isArray(e.topic) ? e.topic.map((t) => String(t).toLowerCase()) : []
  );
  const joined = topics.join(" ");
  if (joined.includes("transfer") || joined.includes("mint") || joined.includes("burn")) return "Token";
  if (joined.includes("swap") || joined.includes("liquidity") || joined.includes("pool")) return "DEX";
  if (joined.includes("offer") || joined.includes("nft") || joined.includes("buy")) return "NFT-like";
  return "Unknown";
}

function categorizeEvents(events) {
  const counts = { mint: 0, transfer: 0, burn: 0, admin: 0, other: 0 };
  for (const e of events) {
    const topics = (Array.isArray(e.topic) ? e.topic : []).map((t) => String(t).toLowerCase()).join(" ");
    if (topics.includes("mint"))     counts.mint++;
    else if (topics.includes("burn")) counts.burn++;
    else if (topics.includes("transfer")) counts.transfer++;
    else if (topics.includes("admin") || topics.includes("upgrade") || topics.includes("set_admin")) counts.admin++;
    else counts.other++;
  }
  return counts;
}

function detectEventPatterns(events) {
  const flags = [];
  if (events.length === 0) return flags;
  const ledgers = events.map((e) => Number(e.ledger || 0)).filter(Boolean).sort((a, b) => a - b);
  for (let i = 0; i < ledgers.length; i++) {
    const windowEnd = ledgers[i] + 100;
    let count = 0;
    for (let j = i; j < ledgers.length && ledgers[j] <= windowEnd; j++) count++;
    if (count >= 10) { flags.push("event_burst"); break; }
  }

  const cats = categorizeEvents(events);
  if (cats.admin > 0) flags.push("admin_events");
  return flags;
}

async function analyzeDeployer(deployerAccount, { signal, network = "testnet" } = {}) {
  const horizonUrl = network === "mainnet" ? HORIZON_MAINNET_URL : HORIZON_URL;
  if (!deployerAccount) return { deployerAccount: null, deployerDomainVerified: false, deployerAgeDays: null };
  try {
    const acc = await fetchJson(`${horizonUrl}/accounts/${encodeURIComponent(deployerAccount)}`, { signal });
    const homeDomain = acc?.home_domain || null;
    const domainInfo = await verifyHomeDomain(homeDomain, deployerAccount);
    const deployerDomainVerified = domainInfo.verified;

    const txRes = await fetchJson(
      `${horizonUrl}/accounts/${encodeURIComponent(deployerAccount)}/transactions?order=asc&limit=1`,
      { signal }
    );
    const oldest = txRes?._embedded?.records?.[0];
    const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
    const deployerAgeDays = Number.isFinite(oldestAt)
      ? Math.max(0, Math.floor((Date.now() - oldestAt) / 86_400_000))
      : null;

    return { deployerAccount, deployerDomainVerified, deployerAgeDays, homeDomain };
  } catch {
    return { deployerAccount, deployerDomainVerified: false, deployerAgeDays: null, homeDomain: null };
  }
}

export async function analyzeContract(contractId, { signal, network = "testnet" } = {}) {
  const isMainnet  = network === "mainnet";
  const rpcUrl     = isMainnet ? SOROBAN_RPC_MAINNET_URL : SOROBAN_RPC_URL;
  const expertNet  = isMainnet ? "public" : "testnet";

  const latestLedger = await getLatestLedger({ signal, rpcUrl });
  const currentLedger = latestLedger?.sequence ?? 0;
  const startLedger   = Math.max(1, currentLedger - 720);

  const expertData = await fetch(
    `https://api.stellar.expert/explorer/${expertNet}/contract/${contractId}`,
    { signal, headers: { accept: "application/json" } }
  ).then(r => r.ok ? r.json() : null).catch(() => null);

  const label = isMainnet ? "Mainnet" : "Testnet";

  const [transactions, events] = await Promise.all([
    getTransactions(startLedger, { signal, limit: 200, rpcUrl }),
    getEvents(startLedger, contractId, { signal, limit: 100, rpcUrl }).catch((e) => {
      return [];
    }),
  ]);

  if (!expertData && events.length === 0) {
    const err = new Error(`Contract not found on ${label}. Make sure you are on the correct network.`);
    err.status = 404;
    throw err;
  }

  const contractTxHashes = new Set(events.map((e) => e.txHash).filter(Boolean));

  const contractTxs = transactions.filter((tx) => {
    if (!tx) return false;
    if (Array.isArray(tx.operations)) {
      return tx.operations.some((op) =>
        (op.type === "invokeHostFunction" || op.type === "invoke_host_function") &&
        op.function?.contractId === contractId
      );
    }
    const txHash = tx.hash || tx.txHash || tx.id;
    return txHash && contractTxHashes.has(txHash);
  });

  const callerSet = new Set();
  for (const tx of contractTxs) {
    if (tx.sourceAccount) callerSet.add(tx.sourceAccount);
  }
  const uniqueCallers = callerSet.size;

  const callerCounts = {};
  for (const tx of contractTxs) {
    if (tx.sourceAccount) callerCounts[tx.sourceAccount] = (callerCounts[tx.sourceAccount] || 0) + 1;
  }
  const maxCallerCount = Math.max(0, ...Object.values(callerCounts));
  const dominantCallerRatio = contractTxs.length > 0 ? maxCallerCount / contractTxs.length : 0;

  const txLedgers    = contractTxs.map((tx) => Number(tx.ledger || 0)).filter(Boolean);
  const eventLedgers = events.map((e) => Number(e.ledger || 0)).filter(Boolean);
  const firstSeen    = Math.min(currentLedger + 1, ...txLedgers, ...eventLedgers);
  const ledgersOld   = firstSeen < currentLedger ? currentLedger - firstSeen : 0;
  const ageDays      = Math.floor(ledgersOld / LEDGERS_PER_DAY);

  const actualDeployer  = expertData?.creator || expertData?.deployer || null;
  const deployerInfo    = await analyzeDeployer(actualDeployer, { signal, network });
  const eventCategories = categorizeEvents(events);
  const eventPatternFlags = detectEventPatterns(events);
  const contractType    = detectContractType(events);

  const invocationCount  = expertData?.invocations ?? contractTxs.length;
  const ageDaysFromExpert = expertData?.created
    ? Math.floor((Date.now() - expertData.created * 1000) / 86_400_000)
    : ageDays;

  return {
    contractId,
    currentLedger,
    startLedger,
    ageDays: ageDaysFromExpert,
    invocationCount,
    totalTxScanned: transactions.length,
    eventCount: events.length,
    eventCategories,
    eventPatternFlags,
    contractType,
    uniqueCallers,
    dominantCallerRatio,
    deployer: deployerInfo,
    rawEvents: events.slice(0, 10),
  };
}