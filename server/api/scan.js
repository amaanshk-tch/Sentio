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
import { getOnchainRisk, getOnchainHistory, getOnchainFlags } from "../soroban/registry.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const ONCHAIN_WRITE_COOLDOWN_MS = 10 * 60 * 1000;
const onchainWriteTimestamps = new Map();

// ─── Helpers ─────────────────────────────────────────

function shouldWriteOnchain(address) {
  const now = Date.now();
  const last = onchainWriteTimestamps.get(address) ?? 0;
  if (now - last < ONCHAIN_WRITE_COOLDOWN_MS) return false;
  onchainWriteTimestamps.set(address, now);
  return true;
}

function assertAccountExists(account, network) {
  if (account) return;
  const label = network === "mainnet" ? "Mainnet" : "Testnet";
  const err = new Error(`Account not found on ${label}. Make sure you are on the correct network.`);
  err.status = 404;
  throw err;
}


function extractAssetSupply(assetsResponse) {
  const record = assetsResponse?._embedded?.records?.[0];
  if (!record || record.amount == null) return null;
  const p = Number(record.amount);
  return Number.isFinite(p) ? p : null;
}

function extractAccountFlags(account, isAsset) {
  const accFlags = account?.flags || {};
  const flags = [];
  if (accFlags.auth_required)  flags.push("auth_required");
  if (accFlags.auth_revocable) flags.push("auth_revocable");
  if (accFlags.auth_immutable) flags.push("auth_immutable");
  if (isAsset && account?.clawback_enabled) flags.push("clawback_enabled");
  return flags;
}

function countRecentTx(records) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return records.filter((t) => {
    const c = Date.parse(t?.created_at || "");
    return Number.isFinite(c) && c >= thirtyDaysAgo;
  }).length;
}


function deriveAgeDays(txOldest) {
  const oldest = txOldest?._embedded?.records?.[0];
  const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
  if (!Number.isFinite(oldestAt)) return null;
  return Math.max(0, Math.floor((Date.now() - oldestAt) / 86_400_000));
}


async function analyseCounterparties(opsPayload, accountId, horizonUrl, signal) {
  if (!opsPayload) return { counterparties: null, operationBreakdown: {} };

  const ops = Array.isArray(opsPayload?._embedded?.records) ? opsPayload._embedded.records : [];
  const counterIds = new Set();
  const operationBreakdown = {};

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

  return { counterparties: { total, unique, knownVerified }, operationBreakdown };
}


function analyseDexExposure(offersPayload) {
  if (!offersPayload) return null;
  const offers = Array.isArray(offersPayload?._embedded?.records) ? offersPayload._embedded.records : [];
  const offerAssets = new Set();
  for (const o of offers) {
    if (o.selling?.asset_code) offerAssets.add(o.selling.asset_code);
    if (o.buying?.asset_code)  offerAssets.add(o.buying.asset_code);
  }
  return { openOffers: offers.length, offerAssets: [...offerAssets] };
}

function analyseClaimableBalances(claimablePayload) {
  if (!claimablePayload) return null;
  const claims = Array.isArray(claimablePayload?._embedded?.records) ? claimablePayload._embedded.records : [];
  return { count: claims.length };
}

function computeTokenConcentration(balances) {
  const nonNative = balances.filter((b) => b?.asset_type && b.asset_type !== "native");
  const amounts = nonNative
    .map((b) => Number.parseFloat(String(b?.balance ?? "0")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const total = amounts.reduce((sum, n) => sum + n, 0);
  const top   = amounts.length > 0 ? Math.max(...amounts) : 0;
  return total > 0 ? top / total : 0;
}


function resolveSuspiciousInteractions(txPattern, velocity) {
  let contractInteractions = 0;
  if (txPattern === "bot_spam") contractInteractions = 3;
  else if (txPattern === "burst") contractInteractions = 2;

  const flaggedTx = txPattern === "normal" ? 0 : Math.max(1, Math.round(velocity * 0.25));
  return { contractInteractions, flaggedTx };
}

function resolveTimeSuspicion(txPattern, velocity, txRecentCount) {
  const recentSuspiciousTx = txPattern === "normal" ? 0 : Math.max(0, Math.min(1, velocity / 40));
  const oldSuspiciousTx = txPattern === "normal"
    ? 0
    : Math.max(0, Math.min(1, Math.max(txRecentCount - velocity, 0) / 200));
  return { recentSuspiciousTx, oldSuspiciousTx };
}



function buildWalletData({
  ageDays, txRecentCount, velocity, txPattern,
  trustlineQuality, tokenConcentration,
  riskyConnections, totalConnections, counterparties,
  account,
}) {
  const { contractInteractions, flaggedTx } = resolveSuspiciousInteractions(txPattern, velocity);
  const { recentSuspiciousTx, oldSuspiciousTx } = resolveTimeSuspicion(txPattern, velocity, txRecentCount);

  return {
    accountAgeDays: ageDays ?? 365,
    tx: { total: txRecentCount ?? 0, last24h: velocity, perHour: velocity / 24 },
    suspicious: { contractInteractions, flaggedTx },
    network: { riskyConnections, totalConnections },
    tokens: {
      concentration: tokenConcentration,
      lowTrustExposure: Math.max(0, Math.min(1, 1 - trustlineQuality / 100)),
    },
    time: {
      recentActivityScore: Math.max(0, Math.min(1, velocity / 40)),
      recentSuspiciousTx,
      oldSuspiciousTx,
    },
    meta: {
      dataCompleteness: [
        ageDays != null,
        txRecentCount != null,
        trustlineQuality != null,
        Array.isArray(account?.balances),
        counterparties != null,
      ].filter(Boolean).length / 5,
    },
  };
}


function buildAgeEntry(ageDays) {
  const value  = ageDays == null ? "Unknown" : `${ageDays} days`;
  const flag   = ageDays != null && ageDays < 14 ? "new_account" : null;
  let status = "Unknown";
  let tone   = "slate";
  if (ageDays != null) {
    if (ageDays < 14)   { status = "New";         tone = "rose";    }
    else if (ageDays < 90)  { status = "Growing"; tone = "amber";   }
    else if (ageDays < 365) { status = "Maturing"; tone = "sky";    }
    else                { status = "Established";  tone = "emerald"; }
  }
  return { key: "age", title: "Account Age", value, status, tone, flag };
}


function buildTxEntry(txRecentCount, txPattern) {
  const value = txRecentCount?.toLocaleString() ?? "Unknown";
  const flag  = txPattern !== "normal" ? txPattern : null;
  let status = "Unknown";
  let tone   = "slate";
  if (txRecentCount != null) {
    if (txRecentCount < 5)  { status = "Very low"; tone = "rose";    }
    else if (txRecentCount < 25) { status = "Low"; tone = "amber";   }
    else                    { status = "Normal";   tone = "emerald"; }
  }
  return { key: "tx", title: "Transactions (30d)", value, status, tone, flag };
}


function buildTrustlinesEntry(trustlinesCount, trustlineQuality, trustlineFlags) {
  const value = trustlinesCount == null ? "Unknown" : String(trustlinesCount);
  const flag  = trustlineFlags.length > 0 ? "lookalike" : null;
  let status = "Unknown";
  let tone   = "slate";
  if (trustlinesCount != null) {
    if (trustlinesCount === 0)         { status = "None";    tone = "amber";   }
    else if (trustlinesCount < 10)     { status = "Typical"; tone = trustlineQuality < 70 ? "amber" : "emerald"; }
    else                               { status = "Broad";   tone = trustlineQuality < 70 ? "amber" : "emerald"; }
  }
  return { key: "trustlines", title: "Trustlines", value, status, tone, flag };
}


function buildDomainEntry(normalizedDomain, domainVerified, accountListed) {
  const value  = normalizedDomain || "—";
  const flag   = !domainVerified ? "no_domain" : null;
  const tone   = domainVerified ? "emerald" : "rose";
  let status = "Unverified";
  if (domainVerified) status = accountListed ? "Verified + Listed" : "Verified";
  return { key: "domain", title: "Domain Status", value, status, tone, flag };
}


function buildSupplyEntry(isAsset, assetSupply) {
  if (!isAsset) return { key: "supply", title: "Asset Supply", value: "—", status: "N/A", tone: "slate", flag: null };
  const value  = assetSupply?.toLocaleString() ?? "Unknown";
  const flag   = isAsset && assetSupply > 600_000_000 ? "high_supply" : null;
  let status = "Unknown";
  let tone   = "slate";
  if (assetSupply != null) {
    status = assetSupply > 600_000_000 ? "Elevated" : "Normal";
    tone   = assetSupply > 600_000_000 ? "amber" : "emerald";
  }
  return { key: "supply", title: "Asset Supply", value, status, tone, flag };
}


function buildFlagsEntry(flags) {
  const status = flags.length ? "Present" : "None";
  const tone   = flags.length ? "amber" : "emerald";
  let flag = null;
  if (flags.includes("clawback_enabled")) flag = "clawback";
  else if (flags.length > 0)             flag = "flagged";
  return { key: "flags", title: "Flags", value: String(flags.length), status, tone, flag };
}


function buildBreakdown({ ageDays, txRecentCount, txPattern, trustlinesCount, trustlineQuality, trustlineFlags, normalizedDomain, domainVerified, accountListed, isAsset, assetSupply, flags }) {
  return [
    buildAgeEntry(ageDays),
    buildTxEntry(txRecentCount, txPattern),
    buildTrustlinesEntry(trustlinesCount, trustlineQuality, trustlineFlags),
    buildDomainEntry(normalizedDomain, domainVerified, accountListed),
    buildSupplyEntry(isAsset, assetSupply),
    buildFlagsEntry(flags),
  ];
}


function maybeWriteOnchain() {}


async function fetchHorizonData(horizonUrl, accountId, isAsset, asset, signal) {
  let assetPromise = Promise.resolve(null);
  if (isAsset) {
    assetPromise = fetchJson(
      `${horizonUrl}/assets?asset_code=${encodeURIComponent(asset.code)}&asset_issuer=${encodeURIComponent(asset.issuer)}&limit=1`,
      { signal }
    ).catch(() => null);
  }

  const accountPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}`, { signal }
  ).catch(() => null);

  const domainPromise = accountPromise
    .then((acc) => verifyHomeDomain(acc?.home_domain || null, accountId))
    .catch(() => ({ verified: false, homeDomain: null, accountListed: false }));

  const txRecentPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/transactions?order=desc&limit=200`, { signal }
  ).catch(() => null);

  const txOldestPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&limit=1`, { signal }
  ).catch(() => null);

  const opsPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/operations?order=desc&limit=50`, { signal }
  ).catch(() => null);

  const offersPromise = fetchJson(
    `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/offers?limit=20`, { signal }
  ).catch(() => null);

  const claimablePromise = fetchJson(
    `${horizonUrl}/claimable_balances?claimant=${encodeURIComponent(accountId)}&limit=10`, { signal }
  ).catch(() => null);

  const [
    assetsResponse, account, domainInfo,
    txRecent, txOldest,
    opsPayload, offersPayload, claimablePayload,
    onchainData, onchainHistory, onchainFlags,
  ] = await Promise.all([
    assetPromise, accountPromise, domainPromise,
    txRecentPromise, txOldestPromise,
    opsPromise, offersPromise, claimablePromise,
    getOnchainRisk(accountId),
    getOnchainHistory(accountId),
    getOnchainFlags(accountId),
  ]);

  return { assetsResponse, account, domainInfo, txRecent, txOldest, opsPayload, offersPayload, claimablePayload, onchainData, onchainHistory, onchainFlags };
}

function buildCacheKey(network, isAsset, asset, query) {
  if (isAsset) return `${network}:asset:${asset.code}:${asset.issuer}`;
  return `${network}:account:${query}`;
}

export async function runScan(query, { signal, prevScore = null, network = "testnet" } = {}) {
  const horizonUrl = getHorizonUrl(network);
  const asset      = parseAsset(query);
  const isAsset    = Boolean(asset);
  const accountId  = isAsset ? asset.issuer : query;

  const {
    assetsResponse, account, domainInfo,
    txRecent, txOldest,
    opsPayload, offersPayload, claimablePayload,
    onchainData, onchainHistory, onchainFlags,
  } = await fetchHorizonData(horizonUrl, accountId, isAsset, asset, signal);

  assertAccountExists(account, network);

  const assetSupply    = extractAssetSupply(assetsResponse);
  const flags          = extractAccountFlags(account, isAsset);
  const { verified: domainVerified, homeDomain: normalizedDomain, accountListed } = domainInfo;
  const balances       = Array.isArray(account?.balances) ? account.balances : [];
  const trustlinesCount = balances.filter((b) => b?.asset_type && b.asset_type !== "native").length;
  const { qualityScore: trustlineQuality, flags: trustlineFlags } = analyzeTrustlines(balances);
  const recentRecords  = Array.isArray(txRecent?._embedded?.records) ? txRecent._embedded.records : [];
  const txRecentCount  = countRecentTx(recentRecords);
  const ageDays        = deriveAgeDays(txOldest);
  const { pattern: txPattern, flags: txFlags, velocity } = analyzeTransactionPatterns(recentRecords);

  const { counterparties, operationBreakdown } = await analyseCounterparties(opsPayload, accountId, horizonUrl, signal);
  const dexExposure        = analyseDexExposure(offersPayload);
  const claimableBalances  = analyseClaimableBalances(claimablePayload);
  const tokenConcentration = computeTokenConcentration(balances);
  const riskyConnections   = Math.max((counterparties?.unique ?? 0) - (counterparties?.knownVerified ?? 0), 0);
  const totalConnections   = Math.max(counterparties?.unique ?? 0, trustlinesCount, 1);
  const sorobanInvocations = operationBreakdown["invoke_host_function"] || 0;

  const walletData = buildWalletData({
    ageDays, txRecentCount, velocity, txPattern,
    trustlineQuality, tokenConcentration,
    riskyConnections, totalConnections, counterparties, account,
  });

  const riskResult = computeRisk({
    ageDays, txRecentCount, trustlinesCount, domainVerified,
    accountListed: accountListed ?? false, flags, isAsset, assetSupply,
    txPattern, trustlineFlags, trustlineQuality, velocity, prevScore,
    balances, network: counterparties, walletData, txFlags,
    dexExposure, claimableBalances, sorobanInvocations,
  });

  const confidence = computeConfidence({ walletData, txRecentCount });

  maybeWriteOnchain(isAsset, query, riskResult, onchainData, confidence);

  const breakdown = buildBreakdown({
    ageDays, txRecentCount, txPattern, trustlinesCount, trustlineQuality, trustlineFlags,
    normalizedDomain, domainVerified, accountListed, isAsset, assetSupply, flags,
  });

  return {
    input: query, isAsset, address: query,
    ...riskResult,
    confidence,
    breakdown,
    counterparties,
    operationBreakdown,
    dexExposure,
    claimableBalances,
    onchainRiskData: onchainData,
    onchainHistory,
    onchainFlags,
    raw: { horizon: horizonUrl, accountId },
  };
}


export async function scanHandler(req, res) {
  try {
    const query = normalizeQuery(req.body?.query ?? "");
    if (!query) return res.status(400).json({ error: "Missing query" });

    const rawNetwork = req.body?.network;
    const network    = rawNetwork === "mainnet" ? "mainnet" : "testnet";

    const asset   = parseAsset(query);
    const isAsset = Boolean(asset);
    if (!isAsset && !isAccount(query)) {
      return res.status(400).json({ error: "Invalid input. Use a Stellar account (G...) or CODE:ISSUER." });
    }

    const cacheKey = buildCacheKey(network, isAsset, asset, query);
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

    let status = 500;
    if (err?.status === 404) status = 404;

    let message = "Scan failed. Please try again.";
    if (err?.name === "AbortError") message = "Request timed out. Please try again.";
    if (err?.status === 404) message = err.message;

    return res.status(status).json({ error: message });
  }
}