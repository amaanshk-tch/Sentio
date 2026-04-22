export interface OnchainRisk {
  score: number;
  confidence: number;
  category: string;
  last_updated: number;
}

export interface OnchainFlag {
  reason: string;
  severity: number;
  timestamp: number;
}

interface ScanContribution {
  key?: string;
  label: string;
  impact: number;
  baseImpact?: number;
}

export interface ScanBreakdownItem {
  key: string;
  title: string;
  value: string;
  status: string;
  tone?: string;
  flag?: string | null;
}

export interface ScanRiskFactors {
  newAccount?: boolean;
  highVelocity?: boolean;
  suspiciousTxPattern?: string | null;
  noDomain?: boolean;
  lookalikeAsset?: boolean;
  poorTrustlineQuality?: boolean;
  authRequired?: boolean;
  authRevocable?: boolean;
  clawbackEnabled?: boolean;
  highSupply?: boolean;
  accountListed?: boolean;
}

export interface ScanResult {
  score: number;
  risk: string;
  level?: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reasons: string[];
  action?: string;
  trend?: "up" | "down" | "stable";
  contributions?: ScanContribution[];
  breakdown?: ScanBreakdownItem[];
  riskFactors?: ScanRiskFactors;
  insight?: string;
  lastUpdated?: number;
  counterparties?: { total: number; unique: number; knownVerified: number } | null;
  operationBreakdown?: Record<string, number>;
  dexExposure?: { openOffers: number; offerAssets: string[] } | null;
  claimableBalances?: { count: number } | null;
}

export interface ContractScanResult {
  type: "contract";
  contractId: string;
  network: "mainnet" | "testnet";
  score: number;
  risk: string;
  color: string;
  confidence: number;
  flags: string[];
  insights: string[];
  recommendation: string;
  summary: string;
  metadata: { ageDays: number | null; contractType: string; deployer: string | null };
  behavior: { invocationCount: number; eventCount: number; uniqueCallers: number; dominantCallerRatio: number };
  riskBreakdown: Record<string, boolean | number>;
  events: { categories: Record<string, number>; raw: unknown[] };
  trend: { direction: string; history: unknown[] };
  onchainRiskData: OnchainRisk | null;
}

export function fmt(n: number, dec = 4) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(dec);
}

export function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

export function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch { return false; }
}

export function isSafeHostname(domain: string): boolean {
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
}

export function deriveRiskLabel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score <= 20) return { label: "Safe",      color: "text-sentio-success",  bg: "bg-sentio-success/10",  border: "border-sentio-success/30" };
  if (score <= 45) return { label: "Low Risk",  color: "text-emerald-400",     bg: "bg-emerald-400/10",     border: "border-emerald-400/30" };
  if (score <= 65) return { label: "Moderate",  color: "text-sentio-warning",  bg: "bg-sentio-warning/10",  border: "border-sentio-warning/30" };
  if (score <= 80) return { label: "High Risk", color: "text-orange-400",      bg: "bg-orange-400/10",      border: "border-orange-400/30" };
  return               { label: "Critical",   color: "text-sentio-danger",   bg: "bg-sentio-danger/10",   border: "border-sentio-danger/30" };
}

export function getTrustBadge(score: number) {
  if (score <= 20) {
    return {
      label: "Verified Safe",
      description: "Minimal on-chain risk recorded.",
      style: "border-sentio-success/30 bg-sentio-success/10 text-sentio-success",
      type: "safe"
    };
  }
  if (score <= 45) {
    return {
      label: "Low Risk",
      description: "Safe in most scenarios but monitor changes.",
      style: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
      type: "shield"
    };
  }
  if (score <= 65) {
    return {
      label: "Moderate",
      description: "Mixed signals detected; review risk factors.",
      style: "border-sentio-warning/30 bg-sentio-warning/10 text-sentio-warning",
      type: "info"
    };
  }
  if (score <= 80) {
    return {
      label: "High Risk",
      description: "Elevated risk found. Use extreme caution.",
      style: "border-orange-400/30 bg-orange-400/10 text-orange-400",
      type: "alert"
    };
  }
  return {
    label: "Critical Risk",
    description: "Strong risk indicators present. Do not interact.",
    style: "border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger",
    type: "alert"
  };
}

export function getHistoryComparison(history: OnchainRisk[]) {
  if (history.length < 2) return null;

  const current = history[0];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const previous = history.find((entry, index) => index > 0 && entry.last_updated <= oneWeekAgo) ?? history[1];

  const delta = current.score - previous.score;
  const trend = delta === 0 ? "stable" : delta > 0 ? "riskier" : "safer";
  const label = delta === 0
    ? "No meaningful change since the last saved checkpoint."
    : delta > 0
      ? `This contract is ${delta} points riskier than the previous saved checkpoint.`
      : `This contract is ${Math.abs(delta)} points safer than the previous saved checkpoint.`;

  return {
    current,
    previous,
    delta,
    trend,
    label,
    previousAgo: timeAgo(new Date(previous.last_updated).toISOString()),
  };
}

export function levelBadge(level?: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "LOW") return "border-sentio-success/30 bg-sentio-success/10 text-sentio-success";
  if (level === "MEDIUM") return "border-sentio-warning/30 bg-sentio-warning/10 text-sentio-warning";
  if (level === "HIGH") return "border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger";
  return "border-foreground/10 bg-foreground/5 text-sentio-text-muted";
}
