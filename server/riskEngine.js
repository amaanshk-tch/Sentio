function parseStellarToml(text) {
  const result = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    const val = line.slice(eq + 1).trim();
    if (val.startsWith("[")) {
      const m = val.match(/\[([^\]]*)\]/);
      if (m) result[key] = m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      result[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNonNegative(value, fallback = 0) {
  return Math.max(0, asNumber(value, fallback));
}

function asRatio(value, fallback = 0) {
  return clamp(asNumber(value, fallback), 0, 1);
}

export async function verifyHomeDomain(homeDomain, accountId) {
  if (!homeDomain) return { homeDomain: null, verified: false, tomlFields: {} };
  const domain = String(homeDomain).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domain || domain.includes(" ") || domain.includes("@"))
    return { homeDomain: domain || null, verified: false, tomlFields: {} };

  const url = `https://${domain}/.well-known/stellar.toml`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return { homeDomain: domain, verified: false, tomlFields: {} };
    const text = await res.text();
    const tomlFields = parseStellarToml(text);
    const hasPassphrase = Boolean(tomlFields.NETWORK_PASSPHRASE);
    const hasSigningKey  = Boolean(tomlFields.SIGNING_KEY);
    const accounts       = Array.isArray(tomlFields.ACCOUNTS) ? tomlFields.ACCOUNTS : [];
    const accountListed  = accountId ? accounts.includes(accountId) : false;
    const verified = hasPassphrase || hasSigningKey || accounts.length > 0;
    return { homeDomain: domain, verified, tomlFields, accountListed };
  } catch {
    return { homeDomain: domain, verified: false, tomlFields: {} };
  }
}

export function analyzeTransactionPatterns(records) {
  if (!Array.isArray(records) || records.length < 2) return { pattern: "normal", flags: [], velocity: 0 };

  const flags = [];

  // Burst detection: ≥10 tx in any 1-hour window
  const timestamps = records
    .map((r) => Date.parse(r.created_at || ""))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  let burstDetected = false;
  let maxWindowCount = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const windowEnd = timestamps[i] + 3_600_000;
    let count = 0;
    for (let j = i; j < timestamps.length && timestamps[j] <= windowEnd; j++) count++;
    maxWindowCount = Math.max(maxWindowCount, count);
    if (count >= 10) { burstDetected = true; break; }
  }
  if (burstDetected) flags.push("burst_activity");

  const now = Date.now();
  const recentTs = timestamps.filter((t) => t >= now - 86_400_000);
  const velocity = recentTs.length;

  const memos = records.map((r) => r.memo || "").filter(Boolean);
  const memoFreq = {};
  for (const m of memos) memoFreq[m] = (memoFreq[m] || 0) + 1;
  if (Math.max(0, ...Object.values(memoFreq)) >= 5 && memos.length >= 5) flags.push("repeated_memo");

  let pattern = "normal";
  if (flags.includes("burst_activity") && flags.includes("repeated_memo")) pattern = "bot_spam";
  else if (flags.includes("burst_activity")) pattern = "burst";
  else if (flags.includes("repeated_memo")) pattern = "bot_spam";

  return { pattern, flags, velocity };
}

const COMMON_LOOKALIKES = ["USDC", "USDT", "XLM", "BTC", "ETH"];

export function analyzeTrustlines(balances) {
  if (!Array.isArray(balances) || balances.length === 0)
    return { qualityScore: 100, flags: [], nonNativeCount: 0 };

  const nonNative = balances.filter((b) => b?.asset_type && b.asset_type !== "native");
  if (nonNative.length === 0) return { qualityScore: 100, flags: [], nonNativeCount: 0 };

  const flags = [];
  const lookalikes = nonNative.filter((b) => {
    const code = (b.asset_code || "").toUpperCase();
    return COMMON_LOOKALIKES.some((known) => code !== known && code.startsWith(known));
  });
  if (lookalikes.length > 0) flags.push(`lookalike_asset:${lookalikes.map((b) => b.asset_code).join(",")}`);

  const qualityScore = Math.round(Math.max(0, 100 - (lookalikes.length / nonNative.length) * 100));
  return { qualityScore, flags, nonNativeCount: nonNative.length };
}

export function normalizeWalletRiskInput(input = {}) {
  const txTotal = asNonNegative(input?.tx?.total);
  const networkRisky = asNonNegative(input?.network?.riskyConnections);
  const networkTotal = Math.max(asNonNegative(input?.network?.totalConnections), networkRisky, 1);

  return {
    accountAgeDays: asNonNegative(input?.accountAgeDays),
    tx: {
      total: txTotal,
      last24h: asNonNegative(input?.tx?.last24h),
      perHour: asNonNegative(input?.tx?.perHour),
    },
    suspicious: {
      contractInteractions: asNonNegative(input?.suspicious?.contractInteractions),
      flaggedTx: asNonNegative(input?.suspicious?.flaggedTx),
    },
    network: {
      riskyConnections: networkRisky,
      totalConnections: networkTotal,
    },
    tokens: {
      concentration: asRatio(input?.tokens?.concentration),
      lowTrustExposure: asRatio(input?.tokens?.lowTrustExposure),
    },
    time: {
      recentActivityScore: asRatio(input?.time?.recentActivityScore),
      recentSuspiciousTx: asNonNegative(input?.time?.recentSuspiciousTx),
      oldSuspiciousTx: asNonNegative(input?.time?.oldSuspiciousTx),
    },
    meta: {
      dataCompleteness: asRatio(input?.meta?.dataCompleteness, 0.5),
    },
  };
}

export function getRiskLevel(score) {
  if (score < 30) return "LOW";
  if (score < 70) return "MEDIUM";
  return "HIGH";
}

function getRiskLabel(level) {
  if (level === "LOW") return "Low Risk";
  if (level === "MEDIUM") return "Medium Risk";
  return "High Risk";
}

function getRiskColor(level) {
  if (level === "LOW") return "emerald";
  if (level === "MEDIUM") return "amber";
  return "rose";
}

export function calculateWalletRisk(rawInput) {
  const data = normalizeWalletRiskInput(rawInput);
  const contributions = [];
  const add = (key, label, points, meta = {}) => {
    if (points <= 0) return;
    contributions.push({ key, label, baseImpact: points, ...meta });
  };

  if (data.accountAgeDays < 7) add("account_age", "New wallet age", 15, { value: `${data.accountAgeDays}d` });
  else if (data.accountAgeDays < 30) add("account_age", "Young wallet age", 8, { value: `${data.accountAgeDays}d` });

  add("suspicious_contracts", "Suspicious contract interactions", Math.min(data.suspicious.contractInteractions * 5, 30), { value: String(data.suspicious.contractInteractions) });
  add("flagged_transactions", "Flagged transaction volume", Math.min(data.suspicious.flaggedTx * 2, 20), { value: String(data.suspicious.flaggedTx) });
  add(
    "tx_frequency",
    "High transaction frequency",
    Math.min(data.tx.perHour / 5, 20),
    { value: `${data.tx.perHour.toFixed(2)}/h` }
  );
  add("risky_connections", "Risky wallet connections", Math.min(data.network.riskyConnections * 4, 20), { value: String(data.network.riskyConnections) });

  add(
    "low_trust_tokens",
    "Low-trust token exposure",
    data.tokens.lowTrustExposure * 20,
    { value: `${(data.tokens.lowTrustExposure * 100).toFixed(1)}%` }
  );
  if (data.tokens.concentration > 0.7) {
    add(
      "token_concentration",
      "Token concentration risk",
      10,
      { value: `${(data.tokens.concentration * 100).toFixed(1)}%` }
    );
  }

  // Interaction effects make manipulation harder and reward multi-signal consistency.
  add("recent_suspicious", "Recent suspicious activity", data.time.recentSuspiciousTx * 10);
  add("old_suspicious", "Historical suspicious activity", data.time.oldSuspiciousTx * 3);

  if (data.suspicious.contractInteractions > 0 && data.tx.perHour > 20) add("interaction_contract_tx", "Compounding suspicious + high-frequency behavior", 10);
  if (data.tokens.lowTrustExposure > 0.6 && data.tokens.concentration > 0.8) {
    add("interaction_token_stack", "Concentrated low-trust token stack", 8);
  }

  const baseScore = contributions.reduce((sum, item) => sum + item.baseImpact, 0);
  const timeMultiplier = 0.6 + data.time.recentActivityScore * 0.4;
  const weightedContributions = contributions.map((item) => ({
    ...item,
    impact: Number((item.baseImpact * timeMultiplier).toFixed(2)),
  }));
  const score = clamp(Math.round(baseScore * timeMultiplier), 0, 100);
  const level = getRiskLevel(score);

  return {
    data,
    score,
    level,
    baseScore: Number(baseScore.toFixed(2)),
    timeMultiplier: Number(timeMultiplier.toFixed(3)),
    contributions: weightedContributions.sort((a, b) => b.impact - a.impact),
  };
}

export function explainWalletRisk(rawInput, evaluation) {
  const data = normalizeWalletRiskInput(rawInput);
  const assessed = evaluation ?? calculateWalletRisk(data);
  const reasons = [];

  if (data.accountAgeDays < 7) reasons.push("New wallet (high risk)");
  else if (data.accountAgeDays < 30) reasons.push("Recently created wallet");
  if (data.suspicious.contractInteractions > 0) reasons.push("Interacted with suspicious contracts");
  if (data.suspicious.flaggedTx > 0) reasons.push("Flagged transactions detected");
  if (data.tx.perHour > 15) reasons.push("High transaction frequency");
  if (data.network.riskyConnections > 3) reasons.push("Connected to risky wallets");
  if (data.time.recentSuspiciousTx > 0) reasons.push("Recent suspicious activity elevated");
  if (data.tokens.lowTrustExposure > 0.5) reasons.push("High exposure to low-trust tokens");
  if (data.tokens.concentration > 0.7) reasons.push("Token holdings are highly concentrated");

  if (reasons.length > 0) return reasons.slice(0, 5);
  return assessed.contributions.slice(0, 3).map((c) => c.label);
}

export function computeConfidence({ walletData, txRecentCount }) {
  const normalized = normalizeWalletRiskInput(walletData ?? { tx: { total: txRecentCount ?? 0 } });
  return Math.round(clamp(normalized.meta.dataCompleteness * 100, 0, 100));
}

function deriveWalletDataFromSignals({
  ageDays,
  txRecentCount,
  domainVerified,
  trustlinesCount,
  trustlineQuality,
  trustlineFlags,
  txPattern,
  txFlags,
  velocity,
  balances,
  network,
  walletData,
}) {
  if (walletData) return normalizeWalletRiskInput(walletData);

  const nonNative = (Array.isArray(balances) ? balances : []).filter((b) => b?.asset_type && b.asset_type !== "native");
  const tokenAmounts = nonNative
    .map((b) => asNonNegative(b?.balance))
    .filter((n) => n > 0);
  const totalTokens = tokenAmounts.reduce((sum, n) => sum + n, 0);
  const topToken = tokenAmounts.length ? Math.max(...tokenAmounts) : 0;
  const concentration = totalTokens > 0 ? topToken / totalTokens : 0;

  const uniqueConnections = asNonNegative(network?.unique);
  const knownVerified = asNonNegative(network?.knownVerified);
  const inferredRiskyConnections = uniqueConnections > 0
    ? Math.max(uniqueConnections - knownVerified, 0)
    : (trustlineFlags?.length ?? 0) + (domainVerified ? 0 : 1);
  const totalConnections = uniqueConnections > 0 ? uniqueConnections : Math.max(asNonNegative(trustlinesCount), 1);

  const suspiciousContracts = txPattern === "bot_spam" ? 3 : txPattern === "burst" ? 2 : 0;
  const flaggedTx = (txPattern === "normal" ? 0 : Math.max(1, Math.round(asNonNegative(velocity) * 0.25))) + (txFlags?.length ?? 0);

  return normalizeWalletRiskInput({
    accountAgeDays: ageDays ?? 365,
    tx: {
      total: txRecentCount ?? 0,
      last24h: velocity ?? 0,
      perHour: asNonNegative(velocity) / 24,
    },
    suspicious: {
      contractInteractions: suspiciousContracts,
      flaggedTx,
    },
    network: {
      riskyConnections: inferredRiskyConnections,
      totalConnections,
    },
    tokens: {
      concentration,
      lowTrustExposure: 1 - asRatio((trustlineQuality ?? 100) / 100, 1),
    },
    time: {
      recentActivityScore: asRatio(asNonNegative(velocity) / 40),
      recentSuspiciousTx: asRatio(asNonNegative(velocity) / 40),
      oldSuspiciousTx: asRatio(asNonNegative((txRecentCount ?? 0) - asNonNegative(velocity)) / 200),
    },
    meta: {
      dataCompleteness: asRatio(
        [
          ageDays != null,
          txRecentCount != null,
          trustlinesCount != null,
          domainVerified !== undefined,
          Array.isArray(balances),
        ].filter(Boolean).length / 5,
        0.5
      ),
    },
  });
}

export function computeRisk({
  ageDays, txRecentCount, trustlinesCount, domainVerified, accountListed,
  flags, isAsset, assetSupply, txPattern, trustlineFlags, trustlineQuality,
  velocity = 0, prevScore = null, balances = [], network = null, walletData = null, txFlags = [],
}) {
  const resolvedWalletData = deriveWalletDataFromSignals({
    ageDays,
    txRecentCount,
    domainVerified,
    trustlinesCount,
    trustlineQuality,
    trustlineFlags,
    txPattern,
    txFlags,
    velocity,
    balances,
    network,
    walletData,
  });
  const evaluation = calculateWalletRisk(resolvedWalletData);
  const score = evaluation.score;
  const level = evaluation.level;
  const risk = getRiskLabel(level);
  const color = getRiskColor(level);
  const factors = evaluation.contributions.map((c) => ({ label: c.label, impact: c.impact }));
  const reasons = explainWalletRisk(resolvedWalletData, evaluation);

  const flagList = Array.isArray(flags) ? flags : [];
  const riskFactors = {
    newAccount: resolvedWalletData.accountAgeDays < 30,
    highVelocity: resolvedWalletData.tx.perHour > 20,
    suspiciousTxPattern: txPattern !== "normal" ? txPattern : null,
    noDomain: !domainVerified,
    lookalikeAsset: (trustlineFlags ?? []).some((f) => f.startsWith("lookalike_asset:")),
    poorTrustlineQuality: trustlineQuality != null && trustlineQuality < 50,
    authRequired: flagList.includes("auth_required"),
    authRevocable: flagList.includes("auth_revocable"),
    clawbackEnabled: flagList.includes("clawback_enabled"),
    highSupply: isAsset && typeof assetSupply === "number" && assetSupply > 600_000_000,
    accountListed: Boolean(accountListed),
  };

  let trend = "stable";
  if (prevScore !== null) {
    if (score > prevScore + 2) trend = "up";
    else if (score < prevScore - 2) trend = "down";
  }

  const action  = level === "LOW"
    ? "Proceed normally. No major red flags detected."
    : level === "MEDIUM"
      ? "Verify the issuer before interacting. Check their official site and stellar.toml."
      : "Do NOT interact. Multiple high-risk signals detected. Treat as untrusted.";

  if (!factors.length) factors.push({ label: "No critical indicators detected", impact: 0 });
  if (!reasons.length) reasons.push("No critical indicators detected");

  return {
    score, level, trend, risk, color, reasons, factors, riskFactors, action,
    walletData: resolvedWalletData,
    contributions: evaluation.contributions,
    timeMultiplier: evaluation.timeMultiplier,
    insight: buildInsight(score, riskFactors),
    lastUpdated: Date.now(),
  };
}

function buildInsight(score, riskFactors) {
  const parts = [];
  if (riskFactors.newAccount)     parts.push("This account was created very recently — scams often appear fresh.");
  if (riskFactors.noDomain)       parts.push("No official website is linked. Legitimate projects verify their domain.");
  if (riskFactors.lookalikeAsset) parts.push("Asset codes closely imitate known tokens (e.g. USDCX vs USDC) — a common scam tactic.");
  if (riskFactors.suspiciousTxPattern === "bot_spam") parts.push("Repeated identical transactions suggest automated bot behavior.");
  if (riskFactors.suspiciousTxPattern === "burst")    parts.push("A flood of transactions in a short window is common in scam campaigns.");
  if (riskFactors.highVelocity)   parts.push("Unusually high transaction frequency detected in the last 24 hours.");
  if (riskFactors.clawbackEnabled) parts.push("The issuer can claw back tokens — your balance could be removed without consent.");

  if (!parts.length) {
    if (score < 30)  return "This entity shows generally healthy signals. Continue monitoring for changes.";
    if (score < 70) return "Mixed signals detected. Review domain and activity patterns before interacting.";
    return "Multiple elevated-risk indicators present. Exercise extreme caution.";
  }
  return parts.join(" ");
}
