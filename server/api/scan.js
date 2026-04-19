import {
  getHorizonUrl,
  fetchJson,
  parseAsset,
  isAccount,
  normalizeQuery,
} from "../utils/stellarContext.js";
import { cacheGet, cacheSet } from "../utils/cache.js";
import {
  verifyHomeDomain,
  analyzeTransactionPatterns,
  analyzeTrustlines,
  computeConfidence,
  computeRisk,
} from "../riskEngine.js";
import { getOnchainRisk, setOnchainRisk, getOnchainHistory, getOnchainFlags } from "../soroban/registry.js";

// Throttle onchain writes to at most once per 10 minutes per address,
// preventing XLM drain from burst scan traffic.
const ONCHAIN_WRITE_COOLDOWN_MS = 10 * 60 * 1000;
const onchainWriteTimestamps = new Map();

function shouldWriteOnchain(address) {
  const now = Date.now();
  const last = onchainWriteTimestamps.get(address) ?? 0;
  if (now - last < ONCHAIN_WRITE_COOLDOWN_MS) return false;
  onchainWriteTimestamps.set(address, now);
  return true;
}

export async function runScan(query, { signal, prevScore = null, network = "testnet" } = {}) {
  const horizonUrl = getHorizonUrl(network);
  const asset   = parseAsset(query);
  const isAsset = Boolean(asset);
  const accountId = isAsset ? asset.issuer : query;
  let address   = query;
  let assetSupply = null;

  
  let assetPromise = Promise.resolve(null);
  if (isAsset) {
    assetPromise = fetchJson(
      `${horizonUrl}/assets?asset_code=${encodeURIComponent(asset.code)}&asset_issuer=${encodeURIComponent(asset.issuer)}&limit=1`,
      { signal }
    ).catch(() => null);
  }

  const accountPromise = fetchJson(`${horizonUrl}/accounts/${encodeURIComponent(accountId)}`, { signal }).catch(() => null);

  const domainPromise = accountPromise.then((acc) => 
    verifyHomeDomain(acc?.home_domain || null, accountId)
  ).catch(() => ({ verified: false, homeDomain: null, accountListed: false }));

  const onchainRiskPromise   = getOnchainRisk(accountId);
  const onchainHistoryPromise = getOnchainHistory(accountId);
  const onchainFlagsPromise   = getOnchainFlags(accountId);

  const txRecentPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/transactions?order=desc&limit=200`,
    { signal }
  ).catch(() => null);
  const txOldestPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&limit=1`,
    { signal }
  ).catch(() => null);

  const opsPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/operations?order=desc&limit=50`,
    { signal }
  ).catch(() => null);
  const offersPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/offers?limit=20`,
    { signal }
  ).catch(() => null);

  const claimablePromise = fetchJson(
    `${horizonUrl}/claimable_balances?claimant=${encodeURIComponent(accountId)}&limit=10`,
    { signal }
  ).catch(() => null);

  const [
    assetsResponse,
    account,
    domainInfo,
    txRecent,
    txOldest,
    opsPayload,
    offersPayload,
    claimablePayload,
    onchainData,
    onchainHistory,
    onchainFlags
  ] = await Promise.all([
    assetPromise,
    accountPromise,
    domainPromise,
    txRecentPromise,
    txOldestPromise,
    opsPromise,
    offersPromise,
    claimablePromise,
    onchainRiskPromise,
    onchainHistoryPromise,
    onchainFlagsPromise
  ]);

  // Hard network segregation: account must exist on the selected network.
  if (!account) {
    const label = network === "mainnet" ? "Mainnet" : "Testnet";
    const err = new Error(`Account not found on ${label}. Make sure you are on the correct network.`);
    err.status = 404;
    throw err;
  }

  if (assetsResponse) {
    const record = assetsResponse?._embedded?.records?.[0];
    if (record?.amount != null) { 
      const p = Number(record.amount); 
      assetSupply = Number.isFinite(p) ? p : null; 
    }
  }

  const { verified: domainVerified, homeDomain: normalizedDomain, accountListed } = domainInfo;

  const balances        = Array.isArray(account?.balances) ? account.balances : [];
  const trustlinesCount = balances.filter((b) => b?.asset_type && b.asset_type !== "native").length;
  const { qualityScore: trustlineQuality, flags: trustlineFlags } = analyzeTrustlines(balances);

  const accFlags = account?.flags || {};
  const flags = [];
  if (accFlags?.auth_required)  flags.push("auth_required");
  if (accFlags?.auth_revocable) flags.push("auth_revocable");
  if (accFlags?.auth_immutable) flags.push("auth_immutable");
  if (isAsset && account?.clawback_enabled) flags.push("clawback_enabled");

  const now           = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  const recentRecords = Array.isArray(txRecent?._embedded?.records) ? txRecent._embedded.records : [];
  const txRecentCount = recentRecords.filter((t) => {
    const c = Date.parse(t?.created_at || "");
    return Number.isFinite(c) && c >= thirtyDaysAgo;
  }).length;

  const { pattern: txPattern, flags: txFlags, velocity } = analyzeTransactionPatterns(recentRecords);

  const oldest   = txOldest?._embedded?.records?.[0];
  const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
  const ageDays  = Number.isFinite(oldestAt) ? Math.max(0, Math.floor((now - oldestAt) / 86_400_000)) : null;

  let counterparties = null;
  let operationBreakdown = {};
  if (opsPayload) {
    const ops = Array.isArray(opsPayload?._embedded?.records) ? opsPayload._embedded.records : [];
    const counterIds = new Set();
    for (const op of ops) {
      if (op.to && op.to !== accountId)           counterIds.add(op.to);
      if (op.from && op.from !== accountId)       counterIds.add(op.from);
      if (op.account && op.account !== accountId) counterIds.add(op.account);
      const opType = op.type || "unknown";
      operationBreakdown[opType] = (operationBreakdown[opType] || 0) + 1;
    }
    const total  = ops.length;
    const unique = counterIds.size;
    let knownVerified = 0;
    
    const cpIds = [...counterIds].slice(0, 5);
    await Promise.all(cpIds.map(async (id) => {
      try {
        const acc = await fetchJson(`${horizonUrl}/accounts/${encodeURIComponent(id)}`, { signal });
        if (acc?.home_domain) knownVerified++;
      } catch {}
    }));
    counterparties = { total, unique, knownVerified };
  }

  let dexExposure = null;
  if (offersPayload) {
    const offers = Array.isArray(offersPayload?._embedded?.records) ? offersPayload._embedded.records : [];
    const offerAssets = new Set();
    for (const o of offers) {
      if (o.selling?.asset_code) offerAssets.add(o.selling.asset_code);
      if (o.buying?.asset_code) offerAssets.add(o.buying.asset_code);
    }
    dexExposure = { openOffers: offers.length, offerAssets: [...offerAssets] };
  }

  let claimableBalances = null;
  if (claimablePayload) {
    const claims = Array.isArray(claimablePayload?._embedded?.records) ? claimablePayload._embedded.records : [];
    claimableBalances = { count: claims.length };
  }

  const nonNativeBalances = balances.filter((b) => b?.asset_type && b.asset_type !== "native");
  const nonNativeAmounts = nonNativeBalances
    .map((b) => Number.parseFloat(String(b?.balance ?? "0")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const totalNonNative = nonNativeAmounts.reduce((sum, n) => sum + n, 0);
  const topTokenBalance = nonNativeAmounts.length > 0 ? Math.max(...nonNativeAmounts) : 0;
  const tokenConcentration = totalNonNative > 0 ? topTokenBalance / totalNonNative : 0;

  const counterpartyUnique = counterparties?.unique ?? 0;
  const counterpartyVerified = counterparties?.knownVerified ?? 0;
  const riskyConnections = Math.max(counterpartyUnique - counterpartyVerified, 0);
  const totalConnections = Math.max(counterpartyUnique, trustlinesCount, 1);

  const walletData = {
    accountAgeDays: ageDays ?? 365,
    tx: {
      total: txRecentCount ?? 0,
      last24h: velocity,
      perHour: velocity / 24,
    },
    suspicious: {
      contractInteractions: txPattern === "bot_spam" ? 3 : txPattern === "burst" ? 2 : 0,
      flaggedTx: txPattern === "normal" ? 0 : Math.max(1, Math.round(velocity * 0.25)),
    },
    network: {
      riskyConnections,
      totalConnections,
    },
    tokens: {
      concentration: tokenConcentration,
      lowTrustExposure: Math.max(0, Math.min(1, 1 - trustlineQuality / 100)),
    },
    time: {
      recentActivityScore: Math.max(0, Math.min(1, velocity / 40)),
      recentSuspiciousTx: txPattern === "normal" ? 0 : Math.max(0, Math.min(1, velocity / 40)),
      oldSuspiciousTx: txPattern === "normal"
        ? 0
        : Math.max(0, Math.min(1, Math.max(txRecentCount - velocity, 0) / 200)),
    },
    meta: {
      dataCompleteness: [
        ageDays != null,
        txRecentCount != null,
        trustlinesCount != null,
        domainVerified !== undefined,
        Array.isArray(account?.balances),
        counterparties != null,
      ].filter(Boolean).length / 6,
    },
  };

  const sorobanInvocations = operationBreakdown["invoke_host_function"] || 0;

  const riskResult = computeRisk({
    ageDays, txRecentCount, trustlinesCount, domainVerified,
    accountListed: accountListed ?? false, flags, isAsset, assetSupply,
    txPattern, trustlineFlags, trustlineQuality, velocity, prevScore,
    balances, network: counterparties, walletData, txFlags,
    dexExposure, claimableBalances, sorobanInvocations,
  });

  const confidence = computeConfidence({ walletData, txRecentCount });

  if (!isAsset && riskResult.score !== onchainData?.score && shouldWriteOnchain(address)) {
    setOnchainRisk(address, {
      score: riskResult.score,
      confidence,
      category: riskResult.risk
    }).catch((e) =>
      console.error("[Sentio] On-chain risk logging failed:", e?.message)
    );
  }

  const breakdown = [
    { key: "age",        title: "Account Age",          value: ageDays == null ? "Unknown" : `${ageDays} days`,                              status: ageDays == null ? "Unknown" : ageDays < 14 ? "New" : ageDays < 90 ? "Growing" : "Established", tone: ageDays == null ? "slate" : ageDays < 14 ? "rose" : ageDays < 90 ? "amber" : "emerald", flag: ageDays != null && ageDays < 14 ? "new_account" : null },
    { key: "tx",         title: "Transactions (30d)",   value: txRecentCount?.toLocaleString() ?? "Unknown",                                  status: txRecentCount == null ? "Unknown" : txRecentCount < 5 ? "Very low" : txRecentCount < 25 ? "Low" : "Normal", tone: txRecentCount == null ? "slate" : txRecentCount < 5 ? "rose" : txRecentCount < 25 ? "amber" : "emerald", flag: txPattern !== "normal" ? txPattern : null },
    { key: "trustlines", title: "Trustlines",            value: trustlinesCount == null ? "Unknown" : String(trustlinesCount),                status: trustlinesCount == null ? "Unknown" : trustlinesCount === 0 ? "None" : trustlinesCount < 10 ? "Typical" : "Broad", tone: trustlinesCount == null ? "slate" : trustlinesCount === 0 ? "amber" : trustlineQuality < 70 ? "amber" : "emerald", flag: trustlineFlags.length > 0 ? "lookalike" : null },
    { key: "domain",     title: "Domain Status",         value: normalizedDomain || "—",                                                       status: domainVerified ? (accountListed ? "Verified + Listed" : "Verified") : "Unverified", tone: domainVerified ? "emerald" : "rose", flag: !domainVerified ? "no_domain" : null },
    { key: "supply",     title: "Asset Supply",          value: isAsset ? (assetSupply?.toLocaleString() ?? "Unknown") : "—",                 status: !isAsset ? "N/A" : assetSupply == null ? "Unknown" : assetSupply > 600_000_000 ? "Elevated" : "Normal", tone: !isAsset ? "slate" : assetSupply == null ? "slate" : assetSupply > 600_000_000 ? "amber" : "emerald", flag: isAsset && assetSupply > 600_000_000 ? "high_supply" : null },
    { key: "flags",      title: "Flags",                 value: String(flags.length),                                                          status: flags.length ? "Present" : "None", tone: flags.length ? "amber" : "emerald", flag: flags.includes("clawback_enabled") ? "clawback" : flags.length > 0 ? "flagged" : null },
  ];

  return {
    input: query, isAsset, address,
    ...riskResult,
    confidence,
    breakdown,
    counterparties,
    operationBreakdown,
    dexExposure,
    claimableBalances,
    onchainRiskData: onchainData,
    onchainHistory: onchainHistory,
    onchainFlags: onchainFlags,
    raw: { horizon: horizonUrl, accountId },
  };
}

export async function scanHandler(req, res) {
  try {
    const query = normalizeQuery(req.body?.query ?? "");
    if (!query) return res.status(400).json({ error: "Missing query" });

    const rawNetwork = req.body?.network;
    const network = rawNetwork === "mainnet" ? "mainnet" : "testnet";

    const asset   = parseAsset(query);
    const isAsset = Boolean(asset);
    if (!isAsset && !isAccount(query)) {
      return res.status(400).json({ error: "Invalid input. Use a Stellar account (G...) or CODE:ISSUER." });
    }

    const cacheKey = isAsset ? `${network}:asset:${asset.code}:${asset.issuer}` : `${network}:account:${query}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 14_000);
    try {
      const result = await runScan(query, { signal: controller.signal, network });
      cacheSet(cacheKey, result);
      return res.json(result);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[scan error]", err?.message);
    const status = err?.status === 404 ? 404 : 500;
    const message = err?.status === 404
      ? err.message
      : err?.name === "AbortError"
        ? "Request timed out. Please try again."
        : "Scan failed. Please try again.";
    return res.status(status).json({ error: message });
  }
}