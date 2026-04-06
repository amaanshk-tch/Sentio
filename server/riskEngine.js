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

export function computeConfidence({ ageDays, txRecentCount, domainVerified, assetSupply, isAsset }) {
  const signals = [ageDays != null, txRecentCount != null, domainVerified !== undefined, !isAsset || assetSupply != null];
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}

function timeWeight(ageInDays) {
  return Math.exp(-(ageInDays ?? 0) / 30);
}

export function computeRisk({
  ageDays, txRecentCount, trustlinesCount, domainVerified, accountListed,
  flags, isAsset, assetSupply, txPattern, trustlineFlags, trustlineQuality,
  velocity = 0, prevScore = null,
}) {
  let score = 100;
  const factors = [];
  const riskFactors = {};

  function penalize(label, base, ageContext = null) {
    const w = ageContext !== null ? timeWeight(ageContext) : 1;
    const impact = -Math.round(base * w);
    factors.push({ label, impact });
    score += impact;
    return impact;
  }
  function bonus(label, pts) {
    factors.push({ label, impact: pts });
    score += pts;
  }

  if (ageDays != null) {
    if (ageDays < 14) {
      penalize("New account (< 14 days)", 30, ageDays);
      riskFactors.newAccount = true;
    } else if (ageDays < 90) {
      penalize("Young account (< 90 days)", 10, ageDays);
      riskFactors.youngAccount = true;
    }
  }

  if (txRecentCount != null) {
    if (txRecentCount < 5) {
      penalize("Very low 30-day activity", 20);
      riskFactors.lowActivity = true;
    } else if (txRecentCount < 25) {
      penalize("Below-average 30-day activity", 8);
    }
  }

  if (velocity > 50) {
    penalize("Very high transaction velocity (> 50 tx/24h)", 15, ageDays);
    riskFactors.highVelocity = true;
  }
  if (!domainVerified) {
    penalize("No verified stellar.toml", 20);
    riskFactors.noDomain = true;
  } else if (accountListed) {
    bonus("Account listed in TOML ACCOUNTS", 8);
  }

  if (trustlinesCount != null && trustlinesCount === 0 && !isAsset) {
    penalize("No trustlines established", 6);
  }
  if (trustlineFlags?.length > 0) {
    for (const f of trustlineFlags) {
      if (f.startsWith("lookalike_asset:")) {
        const codes = f.split(":")[1];
        penalize(`Lookalike asset codes: ${codes}`, 20, ageDays);
        riskFactors.lookalikeAsset = true;
      }
    }
  }
  if (trustlineQuality != null && trustlineQuality < 50) {
    penalize("Poor trustline quality", 12);
    riskFactors.poorTrustlineQuality = true;
  }

  if (txPattern === "bot_spam") {
    penalize("Repeated identical activity (bot/spam)", 25, ageDays);
    riskFactors.suspiciousTxPattern = "bot_spam";
  } else if (txPattern === "burst") {
    penalize("Burst activity in short window", 18, ageDays);
    riskFactors.suspiciousTxPattern = "burst";
  }

  const flagList = Array.isArray(flags) ? flags : [];
  if (flagList.includes("auth_required")) {
    penalize("auth_required flag enabled", 6);
    riskFactors.authRequired = true;
  }
  if (flagList.includes("clawback_enabled")) {
    penalize("Clawback enabled (issuer can take back tokens)", 12);
    riskFactors.clawbackEnabled = true;
  }
  if (flagList.includes("auth_revocable")) {
    penalize("auth_revocable flag enabled", 4);
    riskFactors.authRevocable = true;
  }

  if (isAsset && typeof assetSupply === "number" && assetSupply > 600_000_000) {
    penalize("Very high asset supply", 10);
    riskFactors.highSupply = true;
  }

  score = Math.min(100, Math.max(0, score))
  let trend = "stable";
  if (prevScore !== null) {
    if (score < prevScore - 2) trend = "up";
    else if (score > prevScore + 2) trend = "down";
  }

  const risk    = score > 70 ? "Low Risk"    : score >= 40 ? "Medium Risk" : "High Risk";
  const color   = score > 70 ? "emerald"     : score >= 40 ? "amber"       : "rose";
  const action  = score > 70
    ? "Proceed normally. No major red flags detected."
    : score >= 40
      ? "Verify the issuer before interacting. Check their official site and stellar.toml."
      : "Do NOT interact. Multiple high-risk signals detected. Treat as untrusted.";

  if (!factors.length) factors.push({ label: "No critical indicators detected", impact: 0 });
  const reasons = factors.filter((f) => f.impact < 0).map((f) => f.label);
  if (!reasons.length) reasons.push("No critical indicators detected");

  return {
    score, trend, risk, color, reasons, factors, riskFactors, action,
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
    if (score > 70)  return "This entity shows generally healthy signals. Continue monitoring for changes.";
    if (score >= 40) return "Mixed signals detected. Review domain and activity patterns before interacting.";
    return "Multiple elevated-risk indicators present. Exercise extreme caution.";
  }
  return parts.join(" ");
}
