import type { HorizonAccount, HorizonAsset } from "./stellar";

// ─── Risk Factor ──────────────────────────────────────────────────────────────

export interface RiskFactor {
  id: string;
  label: string;
  description: string;
  score: number;       // 0–100, higher = more risky
  weight: number;      // relative importance
  severity: "low" | "medium" | "high" | "critical";
  value?: string;      // human-readable value shown in UI
}

export interface RiskReport {
  overallScore: number;   // 0–100, higher = MORE RISKY
  label: "Safe" | "Low Risk" | "Moderate" | "High Risk" | "Critical";
  color: string;
  factors: RiskFactor[];
  summary: string;
  accountAgeMs?: number;
  accountAgeLabel?: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function ledgerToDate(ledger: number): Date {
  // Stellar genesis: Jan 31, 2015. Ledger closes ~every 5s.
  // Using a well-known anchor: ledger 1 closed at 2015-09-27 (approximate)
  // Better: use sequence_time if available, or derive from last_modified_ledger
  // We use the Horizon epoch: first ledger ~2015-09-27 at 5s/ledger
  const GENESIS_LEDGER = 1;
  const GENESIS_TS = new Date("2015-09-27T00:00:00Z").getTime();
  const MS_PER_LEDGER = 5000;
  return new Date(GENESIS_TS + (ledger - GENESIS_LEDGER) * MS_PER_LEDGER);
}

function ageLabel(ms: number): string {
  const days = Math.floor(ms / 86400000);
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years} year${years !== 1 ? "s" : ""}`;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function severity(score: number): RiskFactor["severity"] {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

// ─── Account Risk Engine ──────────────────────────────────────────────────────

export function scoreAccount(account: HorizonAccount): RiskReport {
  const factors: RiskFactor[] = [];
  const now = Date.now();

  // 1. Account age (lower ledger = older = safer)
  const accountDate = ledgerToDate(account.last_modified_ledger);
  const ageMs = now - accountDate.getTime();
  const ageDays = ageMs / 86400000;
  let ageScore = 0;
  if (ageDays < 7) ageScore = 85;
  else if (ageDays < 30) ageScore = 60;
  else if (ageDays < 90) ageScore = 35;
  else if (ageDays < 365) ageScore = 15;
  else ageScore = 5;

  factors.push({
    id: "account_age",
    label: "Account Age",
    description: "Newer accounts have higher scam and phishing risk.",
    score: ageScore,
    weight: 2.0,
    severity: severity(ageScore),
    value: ageLabel(ageMs),
  });

  // 2. Multi-sig configuration
  const masterWeight = account.signers.find(s => s.key === account.account_id)?.weight ?? 1;
  const totalSigners = account.signers.length;
  const hasMultiSig = totalSigners > 1 || masterWeight !== 1;
  const thresholds = account.thresholds;
  const hasCustomThresholds = thresholds.low_threshold > 0 || thresholds.med_threshold > 0 || thresholds.high_threshold > 0;
  const multiSigScore = hasMultiSig ? (hasCustomThresholds ? 5 : 15) : 0;

  factors.push({
    id: "multisig",
    label: "Multi-Signature Setup",
    description: hasMultiSig
      ? `${totalSigners} signers configured${hasCustomThresholds ? " with custom thresholds" : ""}.`
      : "Single signer — no multi-sig protection.",
    score: multiSigScore,
    weight: 1.2,
    severity: severity(multiSigScore),
    value: `${totalSigners} signer${totalSigners !== 1 ? "s" : ""}`,
  });

  // 3. Auth flags on account (clawback = risky for holders)
  const { auth_clawback_enabled, auth_revocable, auth_immutable } = account.flags;
  let flagScore = 0;
  const flagNotes: string[] = [];
  if (auth_clawback_enabled) { flagScore += 40; flagNotes.push("clawback enabled"); }
  if (auth_revocable) { flagScore += 25; flagNotes.push("auth revocable"); }
  if (auth_immutable) { flagScore += 10; flagNotes.push("flags immutable"); }
  flagScore = clamp(flagScore);

  factors.push({
    id: "account_flags",
    label: "Account Flags",
    description: flagScore > 0
      ? `Risky flags detected: ${flagNotes.join(", ")}.`
      : "No elevated permission flags.",
    score: flagScore,
    weight: 1.8,
    severity: severity(flagScore),
    value: flagNotes.length > 0 ? flagNotes.join(", ") : "None",
  });

  // 4. XLM balance vs minimum reserve
  const xlmBalance = account.balances.find(b => b.asset_type === "native");
  const xlmAmount = parseFloat(xlmBalance?.balance ?? "0");
  const minReserve = (2 + account.subentry_count) * 0.5;
  const bufferRatio = xlmAmount / minReserve;
  let balanceScore = 0;
  if (xlmAmount < minReserve) balanceScore = 80;
  else if (bufferRatio < 1.5) balanceScore = 40;
  else if (bufferRatio < 5) balanceScore = 15;
  else balanceScore = 5;

  factors.push({
    id: "xlm_balance",
    label: "XLM Balance",
    description: xlmAmount < minReserve
      ? "Balance below minimum reserve — account may be at risk of being merged."
      : "Sufficient XLM reserve balance.",
    score: balanceScore,
    weight: 1.0,
    severity: severity(balanceScore),
    value: `${xlmAmount.toFixed(4)} XLM`,
  });

  // 5. Trustlines count (large number = more exposure)
  const trustlines = account.balances.filter(b => b.asset_type !== "native");
  const tCount = trustlines.length;
  let trustScore = 0;
  if (tCount > 20) trustScore = 65;
  else if (tCount > 10) trustScore = 35;
  else if (tCount > 5) trustScore = 15;
  else trustScore = 5;

  factors.push({
    id: "trustlines",
    label: "Open Trustlines",
    description: tCount > 10
      ? "Large number of trustlines increases exposure to risky assets."
      : "Reasonable number of open trustlines.",
    score: trustScore,
    weight: 0.8,
    severity: severity(trustScore),
    value: `${tCount} trustline${tCount !== 1 ? "s" : ""}`,
  });

  // 6. Home domain presence
  const hasDomain = !!account.home_domain;
  const domainScore = hasDomain ? 5 : 30;

  factors.push({
    id: "home_domain",
    label: "Home Domain",
    description: hasDomain
      ? `Domain set: ${account.home_domain}`
      : "No home domain — cannot verify issuer identity via TOML.",
    score: domainScore,
    weight: 0.9,
    severity: severity(domainScore),
    value: account.home_domain ?? "Not set",
  });

  // 7. Data entries (high data count could indicate special use)
  const dataCount = Object.keys(account.data ?? {}).length;
  const dataScore = dataCount > 10 ? 20 : dataCount > 0 ? 5 : 0;
  factors.push({
    id: "data_entries",
    label: "Data Entries",
    description: `${dataCount} on-chain data entr${dataCount !== 1 ? "ies" : "y"} attached to this account.`,
    score: dataScore,
    weight: 0.5,
    severity: severity(dataScore),
    value: `${dataCount} entr${dataCount !== 1 ? "ies" : "y"}`,
  });

  // ─── Weighted composite ──────────────────────────────────────────────────
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weightedScore = factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight;
  const overall = clamp(Math.round(weightedScore));

  const label =
    overall < 15 ? "Safe" :
    overall < 35 ? "Low Risk" :
    overall < 55 ? "Moderate" :
    overall < 75 ? "High Risk" : "Critical";

  const color =
    overall < 15 ? "hsl(152 100% 45%)" :
    overall < 35 ? "hsl(152 80% 42%)" :
    overall < 55 ? "hsl(43 96% 56%)" :
    overall < 75 ? "hsl(25 95% 55%)" : "hsl(348 100% 58%)";

  const topFactors = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const primaryRisk = topFactors[0];

  const summary = overall < 15
    ? "This account shows no significant risk signals. Standard caution applies."
    : overall < 35
    ? `Minor risk signals detected. Primary concern: ${primaryRisk.label.toLowerCase()}.`
    : overall < 55
    ? `Moderate risk profile. Pay attention to: ${primaryRisk.label.toLowerCase()}.`
    : overall < 75
    ? `High risk account. Significant flags: ${primaryRisk.label.toLowerCase()}.`
    : "Critical risk detected. Exercise extreme caution before interacting with this account.";

  return {
    overallScore: overall,
    label,
    color,
    factors,
    summary,
    accountAgeMs: ageMs,
    accountAgeLabel: ageLabel(ageMs),
  };
}

// ─── Asset Risk Engine ────────────────────────────────────────────────────────

export function scoreAsset(asset: HorizonAsset): RiskReport {
  const factors: RiskFactor[] = [];

  // 1. Auth flags
  const { auth_required, auth_revocable, auth_immutable } = asset.flags;
  let flagScore = 0;
  const flagNotes: string[] = [];
  if (auth_clawback_check(asset)) { flagScore += 50; flagNotes.push("clawback enabled"); }
  if (auth_revocable) { flagScore += 30; flagNotes.push("auth revocable"); }
  if (auth_required) { flagScore += 10; flagNotes.push("auth required"); }
  if (auth_immutable) { flagScore += 5; flagNotes.push("immutable flags"); }
  flagScore = clamp(flagScore);

  factors.push({
    id: "asset_flags",
    label: "Asset Flags",
    description: flagScore > 0
      ? `Risky flags detected: ${flagNotes.join(", ")}.`
      : "No elevated permission flags on this asset.",
    score: flagScore,
    weight: 2.5,
    severity: severity(flagScore),
    value: flagNotes.length > 0 ? flagNotes.join(", ") : "None",
  });

  // 2. Holder count
  const authorized = asset.accounts?.authorized ?? 0;
  let holderScore = 0;
  if (authorized === 0) holderScore = 90;
  else if (authorized < 10) holderScore = 70;
  else if (authorized < 100) holderScore = 40;
  else if (authorized < 1000) holderScore = 20;
  else holderScore = 5;

  factors.push({
    id: "holder_count",
    label: "Holder Count",
    description: authorized < 100
      ? "Very low adoption — could indicate a new or rarely-used asset."
      : "Asset has significant adoption.",
    score: holderScore,
    weight: 2.0,
    severity: severity(holderScore),
    value: `${authorized.toLocaleString()} authorized`,
  });

  // 3. Liquidity pool presence
  const hasPool = (asset.num_liquidity_pools ?? 0) > 0;
  const poolScore = hasPool ? 5 : 35;

  factors.push({
    id: "liquidity",
    label: "Liquidity Pools",
    description: hasPool
      ? `${asset.num_liquidity_pools} pool${(asset.num_liquidity_pools ?? 0) !== 1 ? "s" : ""} — indicates market activity.`
      : "No liquidity pools — limited trading depth.",
    score: poolScore,
    weight: 1.5,
    severity: severity(poolScore),
    value: hasPool ? `${asset.num_liquidity_pools} pool${(asset.num_liquidity_pools ?? 0) !== 1 ? "s" : ""}` : "None",
  });

  // 4. Claimable balances (measure of distribution complexity)
  const cbCount = asset.num_claimable_balances ?? 0;
  const cbScore = cbCount > 500 ? 10 : cbCount > 100 ? 5 : 0;

  factors.push({
    id: "claimable_balances",
    label: "Claimable Balances",
    description: `${cbCount} outstanding claimable balance${cbCount !== 1 ? "s" : ""}.`,
    score: cbScore,
    weight: 0.5,
    severity: severity(cbScore),
    value: `${cbCount}`,
  });

  // 5. Supply concentration
  const totalAuth = parseFloat(asset.balances?.authorized ?? "0");
  const totalAmt = totalAuth + parseFloat(asset.balances?.authorized_to_maintain_liabilities ?? "0");
  const unauthorizedPct = totalAmt > 0
    ? (parseFloat(asset.balances?.unauthorized ?? "0") / totalAmt) * 100
    : 0;
  const concScore = unauthorizedPct > 20 ? 60 : unauthorizedPct > 5 ? 30 : 5;

  factors.push({
    id: "unauthorized_balances",
    label: "Unauthorized Holdings",
    description: unauthorizedPct > 5
      ? `${unauthorizedPct.toFixed(1)}% of supply is in unauthorized accounts.`
      : "Minimal unauthorized balance exposure.",
    score: concScore,
    weight: 1.0,
    severity: severity(concScore),
    value: `${unauthorizedPct.toFixed(2)}%`,
  });

  // Weighted composite
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weightedScore = factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight;
  const overall = clamp(Math.round(weightedScore));

  const label =
    overall < 15 ? "Safe" :
    overall < 35 ? "Low Risk" :
    overall < 55 ? "Moderate" :
    overall < 75 ? "High Risk" : "Critical";

  const color =
    overall < 15 ? "hsl(152 100% 45%)" :
    overall < 35 ? "hsl(152 80% 42%)" :
    overall < 55 ? "hsl(43 96% 56%)" :
    overall < 75 ? "hsl(25 95% 55%)" : "hsl(348 100% 58%)";

  const topFactors = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const primaryRisk = topFactors[0];

  const summary = overall < 15
    ? "This asset appears safe with no major risk signals detected."
    : overall < 35
    ? `Low risk asset. Minor concern: ${primaryRisk.label.toLowerCase()}.`
    : overall < 55
    ? `Moderate risk profile. Primary concern: ${primaryRisk.label.toLowerCase()}.`
    : overall < 75
    ? `High risk asset. Be cautious: ${primaryRisk.label.toLowerCase()}.`
    : "Critical risk. This asset has severe red flags — do not interact without thorough research.";

  return { overallScore: overall, label, color, factors, summary };
}

function auth_clawback_check(asset: HorizonAsset): boolean {
  // Clawback isn't in the asset flags API response directly, but auth_revocable implies it
  return asset.flags.auth_revocable;
}
