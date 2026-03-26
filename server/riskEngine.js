/* ─── TOML Parser ─────────────────────────────────────────────────────────── */
function parseStellarToml(text) {
  const result = {};
  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toUpperCase();
    const val = line.slice(eq + 1).trim();

    if (val.startsWith("[")) {
      const match = val.match(/\[([^\]]*)\]/);
      if (match) {
        result[key] = match[1]
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      }
    } else {
      result[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

/* ─── TOML Verification ───────────────────────────────────────────────────── */

export async function verifyHomeDomain(homeDomain, accountId) {
  if (!homeDomain) return { homeDomain: null, verified: false, tomlFields: {} };
  const domain = String(homeDomain).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domain || domain.includes(" ") || domain.includes("@")) {
    return { homeDomain: domain || null, verified: false, tomlFields: {} };
  }

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

/* ─── Transaction Pattern Analysis ───────────────────────────────────────── */
export function analyzeTransactionPatterns(records) {
  if (!Array.isArray(records) || records.length < 2) {
    return { pattern: "normal", flags: [] };
  }

  const flags = [];

  const timestamps = records
    .map((r) => Date.parse(r.created_at || ""))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  let burstDetected = false;
  for (let i = 0; i < timestamps.length; i++) {
    const windowEnd = timestamps[i] + 3_600_000; // 1 hour
    let count = 0;
    for (let j = i; j < timestamps.length && timestamps[j] <= windowEnd; j++) {
      count++;
    }
    if (count >= 10) { burstDetected = true; break; }
  }
  if (burstDetected) flags.push("burst_activity");

  // ── Operation-level analysis ─────────────────────────────────────────────
  const allOps = records.flatMap((r) => {
    if (!Array.isArray(r._links)) return [];
    return [];
  });

  const memos = records.map((r) => r.memo || "").filter(Boolean);
  const memoFreq = {};
  for (const m of memos) {
    memoFreq[m] = (memoFreq[m] || 0) + 1;
  }
  const maxMemoRepeat = Math.max(0, ...Object.values(memoFreq));
  if (maxMemoRepeat >= 5 && memos.length >= 5) {
    flags.push("repeated_memo");
  }

  // ── Primary pattern ──────────────────────────────────────────────────────
  let pattern = "normal";
  if (flags.includes("burst_activity") && flags.includes("repeated_memo")) {
    pattern = "bot_spam";
  } else if (flags.includes("burst_activity")) {
    pattern = "burst";
  } else if (flags.includes("repeated_memo")) {
    pattern = "bot_spam";
  }

  return { pattern, flags };
}

const COMMON_LOOKALIKES = ["USDC", "USDT", "XLM", "BTC", "ETH"];

export function analyzeTrustlines(balances) {
  if (!Array.isArray(balances) || balances.length === 0) {
    return { qualityScore: 100, flags: [], nonNativeCount: 0 };
  }

  const nonNative = balances.filter((b) => b?.asset_type && b.asset_type !== "native");
  if (nonNative.length === 0) return { qualityScore: 100, flags: [], nonNativeCount: 0 };

  const flags = [];

  const lookalikes = nonNative.filter((b) => {
    const code = (b.asset_code || "").toUpperCase();
    return COMMON_LOOKALIKES.some(
      (known) => code !== known && code.startsWith(known)
    );
  });
  if (lookalikes.length > 0) {
    flags.push(`lookalike_asset:${lookalikes.map((b) => b.asset_code).join(",")}`);
  }

  const lookalikeRatio = lookalikes.length / nonNative.length;
  const qualityScore = Math.round(Math.max(0, 100 - lookalikeRatio * 100));

  return { qualityScore, flags, nonNativeCount: nonNative.length };
}
export function computeConfidence({ ageDays, txRecentCount, domainVerified, assetSupply, isAsset }) {
  const signals = [
    ageDays != null,
    txRecentCount != null,
    domainVerified !== undefined,
    !isAsset || assetSupply != null,
  ];
  const available = signals.filter(Boolean).length;
  return Math.round((available / signals.length) * 100);
}

/* ─── Core Risk Scorer ────────────────────────────────────────────────────── */

export function computeRisk({
  ageDays,
  txRecentCount,
  trustlinesCount,
  domainVerified,
  accountListed,
  flags,
  isAsset,
  assetSupply,
  txPattern,
  trustlineFlags,
  trustlineQuality,
}) {
  let score = 100;
  const reasons = [];
  const riskFactors = {};

  // ── Account age ───────────────────────────────────────────────────────────
  if (ageDays != null) {
    if (ageDays < 14) {
      score -= 30;
      reasons.push("New account (created < 14 days ago)");
      riskFactors.newAccount = true;
    } else if (ageDays < 90) {
      score -= 10;
      reasons.push("Young account (created < 90 days ago)");
      riskFactors.youngAccount = true;
    }
  }

  // ── Recent activity ───────────────────────────────────────────────────────
  if (txRecentCount != null) {
    if (txRecentCount < 5) {
      score -= 20;
      reasons.push("Very low transaction activity in the last 30 days");
      riskFactors.lowActivity = true;
    } else if (txRecentCount < 25) {
      score -= 8;
      reasons.push("Below-average transaction activity in the last 30 days");
    }
  }

  // ── Domain verification ───────────────────────────────────────────────────
  if (!domainVerified) {
    score -= 20;
    reasons.push("No verified stellar.toml (home domain missing or invalid)");
    riskFactors.noDomain = true;
  } else if (accountListed) {
    score += 8;
  }

  // ── Trustlines  ───────────────────────────────────────────────────────────
  if (trustlinesCount != null && trustlinesCount === 0 && !isAsset) {
    score -= 6;
    reasons.push("No trustlines established");
  }

  if (trustlineFlags && trustlineFlags.length > 0) {
    for (const f of trustlineFlags) {
      if (f.startsWith("lookalike_asset:")) {
        const codes = f.split(":")[1];
        score -= 20;
        reasons.push(`Lookalike asset codes found: ${codes}`);
        riskFactors.lookalikeAsset = true;
      }
    }
  }

  if (trustlineQuality != null && trustlineQuality < 50) {
    score -= 12;
    riskFactors.poorTrustlineQuality = true;
  }

  // ── Behavioral transaction patterns ───────────────────────────────────────
  if (txPattern === "bot_spam") {
    score -= 25;
    reasons.push("Suspicious transaction pattern: repeated identical activity");
    riskFactors.suspiciousTxPattern = "bot_spam";
  } else if (txPattern === "burst") {
    score -= 18;
    reasons.push("Burst activity detected: many transactions in a short window");
    riskFactors.suspiciousTxPattern = "burst";
  } else if (txPattern === "dusting") {
    score -= 20;
    reasons.push("Micro-payment (dusting) pattern detected");
    riskFactors.suspiciousTxPattern = "dusting";
  }

  // ── Account flags ─────────────────────────────────────────────────────────
  const flagList = Array.isArray(flags) ? flags : [];
  if (flagList.includes("auth_required")) {
    score -= 6;
    reasons.push("auth_required flag enabled");
    riskFactors.authRequired = true;
  }
  if (flagList.includes("clawback_enabled")) {
    score -= 12;
    reasons.push("Clawback enabled — issuer can take back tokens");
    riskFactors.clawbackEnabled = true;
  }
  if (flagList.includes("auth_revocable")) {
    score -= 4;
    riskFactors.authRevocable = true;
  }

  // ── Asset supply ──────────────────────────────────────────────────────────
  if (isAsset && typeof assetSupply === "number") {
    if (assetSupply > 600_000_000) {
      score -= 10;
      reasons.push("Very high asset supply");
      riskFactors.highSupply = true;
    }
  }

  // ── Clamp + labels ────────────────────────────────────────────────────────
  score = Math.min(100, Math.max(0, score));

  const risk  = score > 70 ? "Low Risk" : score >= 40 ? "Medium Risk" : "High Risk";
  const color = score > 70 ? "emerald" : score >= 40 ? "amber" : "rose";

  if (!reasons.length) reasons.push("No critical indicators detected");

  // ── ELI5 insight ──────────────────────────────────────────────────────────
  const insight = buildInsight(score, riskFactors);

  // ── Action recommendation ─────────────────────────────────────────────────
  const action =
    score > 70
      ? "Proceed normally. No major red flags detected."
      : score >= 40
        ? "Verify the issuer before interacting. Check their official website and stellar.toml."
        : "Do NOT interact. Multiple high-risk signals detected. Treat as untrusted.";

  return { score, risk, color, reasons, riskFactors, insight, action };
}

/* ─── ELI5 Insight Builder ────────────────────────────────────────────────── */

function buildInsight(score, riskFactors) {
  const parts = [];

  if (riskFactors.newAccount) {
    parts.push("This account was created very recently — scams and test accounts often appear fresh.");
  }
  if (riskFactors.noDomain) {
    parts.push("No official website is linked to this account. Legitimate projects almost always verify their domain.");
  }
  if (riskFactors.lookalikeAsset) {
    parts.push("One or more asset codes closely imitate well-known tokens (e.g. USDCX instead of USDC) — a common scam tactic.");
  }
  if (riskFactors.suspiciousTxPattern === "bot_spam") {
    parts.push("The transaction history shows repeated identical activity, which is a strong signal of automated bot behavior.");
  }
  if (riskFactors.suspiciousTxPattern === "burst") {
    parts.push("A large number of transactions happened in a very short window — this is often seen in scam campaigns.");
  }
  if (riskFactors.clawbackEnabled) {
    parts.push("The issuer can claw back tokens they have issued, meaning your balance could be removed without your consent.");
  }

  if (parts.length === 0) {
    if (score > 70) return "This entity shows generally healthy signals. Continue monitoring for changes in flags, domain, and activity.";
    if (score >= 40) return "This entity has mixed signals. Review domain verification, account maturity, and activity patterns before interacting.";
    return "This entity shows multiple elevated-risk indicators. Exercise extreme caution.";
  }

  return parts.join(" ");
}
