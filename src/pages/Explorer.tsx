import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowLeft, Shield, AlertTriangle, Clock, Globe,
  Layers, Key, Coins, Users, TrendingUp, ExternalLink,
  Copy, Check, RefreshCw, AlertCircle, Info, Activity, Wifi, WifiOff, FileCode,
  ArrowUpRight, ArrowDownRight, Minus, Share2, BarChart3, Gift
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/landing/BrandMark";
import { PageLayout } from "@/components/layout/PageLayout";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  searchStellar, fetchAccountTransactions, fetchAccountOperations, fetchLatestLedger,
  type HorizonAccount, type HorizonAsset, type HorizonTransaction, type HorizonOperation, type LedgerStats,
} from "@/lib/stellar";

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

interface ScanBreakdownItem {
  key: string;
  title: string;
  value: string;
  status: string;
  tone?: string;
  flag?: string | null;
}

interface ScanRiskFactors {
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

interface ScanResult {
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

interface ContractScanResult {
  type: "contract";
  contractId: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── WebSocket live stream hook ───────────────────────────────────────────────

type StreamStatus = "idle" | "live" | "stopped";

function useLiveStream(
  accountId: string | null,
  onUpdate: (patch: Partial<ScanResult>) => void,
): { status: StreamStatus; lastTxId: string | null } {
  const wsRef   = useRef<WebSocket | null>(null);
  const [status, setStatus]   = useState<StreamStatus>("idle");
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    // close any previous socket
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setLastTxId(null);

    if (!accountId) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", accountId }));
      setStatus("live");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "update") {
          const { type: _t, newTx, ...scanPatch } = msg;
          if (newTx?.id) setLastTxId(newTx.id as string);
          onUpdateRef.current(scanPatch as Partial<ScanResult>);
        } else if (msg.type === "stream_stopped") {
          setStatus("stopped");
        }
      } catch {}
    };

    ws.onerror  = () => setStatus("stopped");
    ws.onclose  = () => setStatus((s) => s === "live" ? "stopped" : s);

    return () => {
      ws.send(JSON.stringify({ type: "unsubscribe" }));
      ws.close();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return { status, lastTxId };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 4) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(dec);
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Risk Score helpers ───────────────────────────────────────────────────────

function deriveRiskLabel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score <= 20) return { label: "Safe",      color: "text-sentio-success",  bg: "bg-sentio-success/10",  border: "border-sentio-success/30" };
  if (score <= 45) return { label: "Low Risk",  color: "text-emerald-400",     bg: "bg-emerald-400/10",     border: "border-emerald-400/30" };
  if (score <= 65) return { label: "Moderate",  color: "text-sentio-warning",  bg: "bg-sentio-warning/10",  border: "border-sentio-warning/30" };
  if (score <= 80) return { label: "High Risk", color: "text-orange-400",      bg: "bg-orange-400/10",      border: "border-orange-400/30" };
  return               { label: "Critical",   color: "text-sentio-danger",   bg: "bg-sentio-danger/10",   border: "border-sentio-danger/30" };
}

function levelBadge(level?: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "LOW") return "border-sentio-success/30 bg-sentio-success/10 text-sentio-success";
  if (level === "MEDIUM") return "border-sentio-warning/30 bg-sentio-warning/10 text-sentio-warning";
  if (level === "HIGH") return "border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger";
  return "border-foreground/10 bg-foreground/5 text-sentio-text-muted";
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 inline-flex items-center rounded-md p-1 text-sentio-text-muted transition hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-sentio-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sentio-shimmer rounded-lg ${className}`} />;
}

// ─── Risk Score Card ──────────────────────────────────────────────────────────

function RiskScoreCard({ onchainHistory }: { onchainHistory: OnchainRisk[] }) {
  if (onchainHistory.length === 0) return null;
  const latest = onchainHistory[0];
  const { label, color, bg, border } = deriveRiskLabel(latest.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 flex items-center justify-between gap-6 rounded-2xl border ${border} ${bg} p-5`}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sentio-text-muted mb-1">Risk Assessment</p>
        <p className={`text-4xl font-bold tabular-nums ${color}`}>
          {latest.score}<span className="text-lg text-sentio-text-muted font-medium">/100</span>
        </p>
        <p className={`mt-1 text-sm font-semibold ${color}`}>{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-sentio-text-muted mb-1 uppercase tracking-wider font-bold">Category</p>
        <p className="text-base font-semibold text-white capitalize">{latest.category || "Unknown"}</p>
        <p className="text-xs text-sentio-text-muted mt-1">Confidence: {latest.confidence}%</p>
        <p className="text-xs text-sentio-text-muted mt-0.5">{timeAgo(new Date(latest.last_updated).toISOString())}</p>
      </div>
    </motion.div>
  );
}

// Risk factor pill metadata
const RISK_FACTOR_META: Record<string, { label: string; variant: "danger" | "warning" | "muted" }> = {
  newAccount:           { label: "New account",           variant: "danger"  },
  highVelocity:         { label: "High velocity",         variant: "danger"  },
  noDomain:             { label: "No domain",             variant: "warning" },
  lookalikeAsset:       { label: "Lookalike asset",       variant: "danger"  },
  poorTrustlineQuality: { label: "Poor trustlines",       variant: "warning" },
  authRequired:         { label: "Auth required",         variant: "warning" },
  authRevocable:        { label: "Auth revocable",        variant: "warning" },
  clawbackEnabled:      { label: "Clawback enabled",      variant: "danger"  },
  highSupply:           { label: "High supply",           variant: "warning" },
};

const VARIANT_STYLES = {
  danger:  "border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger",
  warning: "border-sentio-warning/30 bg-sentio-warning/10 text-sentio-warning",
  muted:   "border-foreground/10 bg-sentio-surface/50 text-sentio-text-muted",
};

function RiskFactorPills({ riskFactors }: { riskFactors: ScanRiskFactors }) {
  const active: { key: string; label: string; variant: "danger" | "warning" | "muted" }[] = [];

  for (const [key, meta] of Object.entries(RISK_FACTOR_META)) {
    const val = riskFactors[key as keyof ScanRiskFactors];
    if (val) active.push({ key, ...meta });
  }
  // suspiciousTxPattern is a string, not a boolean
  if (riskFactors.suspiciousTxPattern) {
    active.push({
      key: "suspiciousTxPattern",
      label: `Pattern: ${riskFactors.suspiciousTxPattern.replace(/_/g, " ")}`,
      variant: "danger",
    });
  }

  if (active.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {active.map(({ key, label, variant }) => (
        <span
          key={key}
          className={`inline-flex rounded-md border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${VARIANT_STYLES[variant]}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function EngineRiskCard({ scan, isLive }: { scan: ScanResult | null; isLive?: boolean }) {
  if (!scan) return null;
  const { label, color, bg, border } = deriveRiskLabel(scan.score);
  const topContribs = (scan.contributions ?? []).slice(0, 5);
  const topReasons = (scan.reasons ?? []).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 rounded-2xl border ${border} ${bg} p-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sentio-text-muted mb-1">Risk Engine Analysis</p>
          <div className="flex items-end gap-2">
            <p key={scan.score} className={`text-4xl font-bold tabular-nums ${color} ${isLive ? "animate-score-flash" : ""}`}>
              {scan.score}<span className="text-lg text-sentio-text-muted font-medium">/100</span>
            </p>
            {/* Trend arrow */}
            {scan.trend && scan.trend !== "stable" && (
              <span className={`flex items-center gap-0.5 text-sm font-bold mb-1 ${
                scan.trend === "up" ? "text-sentio-danger" : "text-sentio-success"
              }`}>
                {scan.trend === "up"
                  ? <ArrowUpRight className="h-4 w-4" />
                  : <ArrowDownRight className="h-4 w-4" />
                }
                {scan.trend === "up" ? "Rising" : "Falling"}
              </span>
            )}
            {scan.trend === "stable" && (
              <span className="flex items-center gap-0.5 text-sm font-bold mb-1 text-sentio-text-muted">
                <Minus className="h-4 w-4" /> Stable
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm font-semibold ${color}`}>{label}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${levelBadge(scan.level)}`}>
            {scan.level ?? scan.risk}
          </span>
          <p className="text-xs text-sentio-text-muted">Confidence: {scan.confidence}%</p>
          {scan.lastUpdated && (
            <p className="text-xs text-sentio-text-muted">
              Updated {timeAgo(new Date(scan.lastUpdated).toISOString())}
            </p>
          )}
          {/* Share / copy link */}
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-sentio-surface/50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-sentio-text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
        </div>
      </div>

      {/* Risk factor pills — truthy flags only */}
      {scan.riskFactors && <RiskFactorPills riskFactors={scan.riskFactors} />}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-foreground/8 bg-sentio-surface/40 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted mb-3">Top Reasons</p>
          {topReasons.length === 0 ? (
            <p className="text-sm text-sentio-text-muted">No major risk reasons found.</p>
          ) : (
            <div className="space-y-2">
              {topReasons.map((reason, idx) => (
                <div key={`${reason}-${idx}`} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-foreground/8 bg-sentio-surface/40 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted mb-3">Signal Impact</p>
          {topContribs.length === 0 ? (
            <p className="text-sm text-sentio-text-muted">No weighted contributors available.</p>
          ) : (
            <div className="space-y-2.5">
              {topContribs.map((c, idx) => {
                const width = Math.max(6, Math.min(100, (c.impact / 30) * 100));
                return (
                  <div key={`${c.label}-${idx}`}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-sentio-text-secondary">{c.label}</span>
                      <span className="font-mono text-foreground">{c.impact.toFixed(1)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-linear-to-r from-primary to-accent" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {scan.action && (
        <div className="mt-4 rounded-xl border border-foreground/8 bg-black/20 px-4 py-3 text-sm text-sentio-text-secondary">
          <span className="font-semibold text-foreground">Recommended action:</span> {scan.action}
        </div>
      )}

      {/* Insight callout — human-readable summary sentence */}
      {scan.insight && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-sentio-text-secondary leading-relaxed">{scan.insight}</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── 24h Flag Banner ──────────────────────────────────────────────────────────

function FlagBanner({ flags }: { flags: OnchainFlag[] }) {
  // eslint-disable-next-line react-hooks/purity
  const recentFlags = flags.filter(f => (Date.now() - f.timestamp) <= 24 * 60 * 60 * 1000);
  if (recentFlags.length === 0) return null;

  const maxSeverity = Math.max(...recentFlags.map(f => f.severity));
  const latestReason = recentFlags[0]?.reason;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-start gap-4 rounded-2xl border border-sentio-danger/30 bg-sentio-danger/10 p-5 shadow-[0_0_20px_rgba(225,29,72,0.1)] relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <AlertTriangle className="h-24 w-24 text-sentio-danger" />
      </div>
      <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-sentio-danger/20">
        <AlertCircle className="h-5 w-5 text-sentio-danger animate-pulse" />
      </div>
      <div className="z-10">
        <h3 className="text-sm font-bold text-sentio-danger uppercase tracking-wider">
          Flagged in the last 24 hours
        </h3>
        <p className="mt-1 text-sm text-sentio-text-secondary">
          This address has received <strong className="text-foreground">{recentFlags.length} active warning(s)</strong>.
          Latest reason: <span className="text-foreground font-medium">"{latestReason}"</span>
        </p>
        <div className="mt-3">
          <span className="inline-flex rounded-lg bg-sentio-danger/20 px-2.5 py-1 text-xs font-bold text-sentio-danger">
            Max Severity: {maxSeverity}/100
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Scan Breakdown Card ─────────────────────────────────────────────────────

const toneStyles: Record<string, { border: string; bg: string; text: string; badge: string; dot: string }> = {
  emerald: {
    border: "border-emerald-500/25",
    bg:     "bg-emerald-500/8",
    text:   "text-emerald-400",
    badge:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    dot:    "bg-emerald-400",
  },
  rose: {
    border: "border-rose-500/25",
    bg:     "bg-rose-500/8",
    text:   "text-rose-400",
    badge:  "bg-rose-500/15 text-rose-400 border border-rose-500/25",
    dot:    "bg-rose-400",
  },
  amber: {
    border: "border-amber-500/25",
    bg:     "bg-amber-500/8",
    text:   "text-amber-400",
    badge:  "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    dot:    "bg-amber-400",
  },
  slate: {
    border: "border-foreground/8",
    bg:     "bg-sentio-surface/40",
    text:   "text-sentio-text-muted",
    badge:  "bg-white/5 text-sentio-text-muted border border-foreground/8",
    dot:    "bg-sentio-text-muted",
  },
};

const breakdownIcons: Record<string, React.ElementType> = {
  age:        Clock,
  tx:         Activity,
  trustlines: Layers,
  domain:     Globe,
  supply:     TrendingUp,
  flags:      Shield,
};

function ScanBreakdownCard({ breakdown }: { breakdown: ScanBreakdownItem[] }) {
  if (!breakdown || breakdown.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6"
    >
      <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" /> Signal Breakdown
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {breakdown.map((item) => {
          const tone   = toneStyles[item.tone ?? "slate"] ?? toneStyles.slate;
          const Icon   = breakdownIcons[item.key] ?? Info;
          return (
            <div
              key={item.key}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-colors ${tone.border} ${tone.bg}`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-sentio-text-muted leading-none">
                    {item.title}
                  </span>
                </div>
              </div>

              {/* Value */}
              <p className={`text-base font-bold leading-snug ${item.value === "—" ? "text-sentio-text-muted" : "text-foreground"}`}>
                {item.value}
              </p>

              {/* Status badge */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${tone.badge}`}>
                  {item.status}
                </span>
                {item.flag && (
                  <span className="inline-flex rounded-md border border-sentio-warning/25 bg-sentio-warning/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-sentio-warning">
                    {item.flag.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Shared: Onchain Flags & History (used in both Account and Asset panels) ──

function OnchainFlagsCard({ flags }: { flags: OnchainFlag[] }) {
  return (
    <div className="rounded-2xl border border-sentio-warning/40 bg-sentio-warning/5 p-6 flex flex-col max-h-[350px]">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-warning flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> On-chain Incident Reports
      </h3>
      <div className="space-y-3 overflow-y-auto pr-1">
        {flags.map((flag, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-sentio-warning/20 bg-background/60 p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-white">
                Reason: <span className="font-medium text-sentio-warning">"{flag.reason}"</span>
              </p>
              <span className="rounded bg-sentio-warning/20 px-2 py-1 text-[0.65rem] uppercase tracking-wider font-bold text-sentio-warning">
                Severity: {flag.severity}/100
              </span>
            </div>
            <div className="text-xs flex justify-end text-sentio-text-muted mt-2 border-t border-white/5 pt-2">
              <span>{timeAgo(new Date(flag.timestamp).toISOString())}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnchainHistoryCard({ history }: { history: OnchainRisk[] }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col max-h-[350px]">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
        <Shield className="h-4 w-4" /> On-chain Risk Assessment History
      </h3>
      <div className="space-y-3 overflow-y-auto pr-1">
        {history.map((hist, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white capitalize">{hist.category}</p>
              <p className="text-xs text-sentio-text-muted mt-1">{timeAgo(new Date(hist.last_updated).toISOString())}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white tabular-nums">
                {hist.score}<span className="text-sm text-sentio-text-muted font-medium">/100</span>
              </p>
              <p className="text-[0.65rem] uppercase tracking-wider font-bold text-primary mt-1">Conf: {hist.confidence}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Protocol Flag label descriptions ─────────────────────────────────────────

const FLAG_DESCRIPTIONS: Record<string, string> = {
  auth_required:        "The issuer must approve any account that wants to hold this asset.",
  auth_revocable:       "The issuer can freeze an account's ability to transact with this asset.",
  auth_immutable:       "The above auth settings can never be changed — they are locked forever.",
  auth_clawback_enabled:"The issuer can claw back (forcibly retrieve) this asset from any holder.",
};

// ─── Account Result Panel ──────────────────────────────────────────────────────

interface AccountPanelProps {
  account: HorizonAccount;
  txns: HorizonTransaction[];
  ops: HorizonOperation[];
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
  scanResult: ScanResult | null;
  isLive?: boolean;
}

function AccountPanel({ account, txns, ops, onchainHistory, onchainFlags, scanResult, isLive }: AccountPanelProps) {
  const xlmBal = account.balances.find(b => b.asset_type === "native");
  const tokens = account.balances.filter(b => b.asset_type !== "native" && b.asset_type !== "liquidity_pool_shares");

  return (
    <div className="space-y-4">
      <EngineRiskCard scan={scanResult} isLive={isLive} />
      {scanResult?.breakdown && <ScanBreakdownCard breakdown={scanResult.breakdown} />}
      <RiskScoreCard onchainHistory={onchainHistory} />
      <FlagBanner flags={onchainFlags} />

      {/* Identity header */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase">
              Stellar Account
            </span>
            <div className="flex items-center gap-2 mt-2">
              <h2 className="font-mono text-xl md:text-3xl font-semibold break-all text-white">
                {account.account_id}
              </h2>
              <div className="flex shrink-0">
                <CopyButton text={account.account_id} />
                <a
                  href={`https://stellar.expert/explorer/public/account/${account.account_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 flex items-center justify-center p-1.5 text-sentio-text-muted hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
            {account.home_domain && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                <Globe className="h-4 w-4" />
                <a href={`https://${account.home_domain}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                  {account.home_domain}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Coins,     label: "XLM Balance", value: `${parseFloat(xlmBal?.balance ?? "0").toFixed(4)}` },
            { icon: Layers,    label: "Tokens",       value: `${tokens.length}` },
            { icon: Key,       label: "Signers",      value: `${account.signers.length}` },
            { icon: Users,     label: "Subentries",   value: `${account.subentry_count}` },
            { icon: TrendingUp,label: "Sponsoring",   value: `${account.num_sponsoring}` },
            { icon: Users,     label: "Sponsored",    value: `${account.num_sponsored}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-sentio-text-muted" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Protocol Flags */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Shield className="h-4 w-4" /> Account Protocol Flags
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(account.flags).map(([k, v]) => (
              <Tooltip key={k}>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-help transition-colors ${
                    v
                      ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                      : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
                  }`}>
                    {k.replace(/_/g, " ")}{v ? " ✓" : " ✗"}
                    <Info className="h-3 w-3 opacity-60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  {FLAG_DESCRIPTIONS[k] ?? "No description available."}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {Object.values(account.flags).every(v => !v) && (
            <p className="text-sm mt-2 text-sentio-text-muted">No elevated protocol flags enabled.</p>
          )}
        </div>

        {/* Signers */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Key className="h-4 w-4" /> Signers & Thresholds
          </h3>
          <div className="flex gap-4 mb-4 pb-4 border-b border-white/5 text-sm">
            {(["low_threshold", "med_threshold", "high_threshold"] as const).map(k => (
              <div key={k} className="flex flex-col">
                <span className="text-sentio-text-muted text-xs uppercase">{k.replace("_threshold", "")}</span>
                <span className="font-mono font-bold mt-1 text-white">{account.thresholds[k]}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1">
            {account.signers.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                <div className="overflow-hidden">
                  <p className="font-mono text-sm text-foreground truncate">{s.key}</p>
                  <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-sentio-text-muted mt-1">{s.type}</p>
                </div>
                <span className="shrink-0 ml-3 rounded-lg border border-primary/20 bg-primary/10 text-primary px-3 py-1 text-sm font-bold">
                  W: {s.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Trustlines — always rendered, shows empty state if none */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[400px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Layers className="h-4 w-4" /> Trustlines ({tokens.length})
          </h3>
          {tokens.length === 0 ? (
            <p className="text-sm text-sentio-text-muted mt-2">No trustlines found on this account.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {tokens.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {(b.asset_code ?? "?").slice(0, 2)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-base font-bold flex items-center gap-2">
                        {b.asset_code ?? "Unknown"}
                        {b.is_authorized === false && (
                          <span className="text-[0.6rem] uppercase tracking-wider bg-sentio-warning/20 text-sentio-warning px-1.5 py-0.5 rounded">Unauthorized</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-xs font-mono text-sentio-text-muted truncate max-w-[160px]" title={b.asset_issuer}>
                          {b.asset_issuer ? shortAddress(b.asset_issuer) : ""}
                        </p>
                        {b.asset_issuer && <CopyButton text={b.asset_issuer} />}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-base font-semibold">{parseFloat(b.balance).toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions — always rendered */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[400px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Clock className="h-4 w-4" /> Recent Transactions
          </h3>
          {txns.length === 0 ? (
            <p className="text-sm text-sentio-text-muted mt-2">No recent transactions found.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {txns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                   <div className="overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2 w-2 rounded-full ${tx.successful ? "bg-sentio-success" : "bg-sentio-danger"}`} />
                      <p className="font-mono text-sm text-foreground truncate">{shortAddress(tx.id)}</p>
                      <CopyButton text={tx.id} />
                    </div>
                    <p className="text-xs text-sentio-text-muted font-medium">
                      {tx.operation_count} op{tx.operation_count !== 1 ? "s" : ""} · {timeAgo(tx.created_at)} · Fee: {tx.fee_charged} stroops
                    </p>
                  </div>
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${tx.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 ml-2 p-2 rounded-lg bg-white/5 text-sentio-text-muted hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Onchain flags & history */}
      {(onchainFlags.length > 0 || onchainHistory.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {onchainFlags.length > 0 && <OnchainFlagsCard flags={onchainFlags} />}
          {onchainHistory.length > 0 && <OnchainHistoryCard history={onchainHistory} />}
        </div>
      )}

      {/* Recent Operations */}
      {ops.length > 0 && (
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[350px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Activity className="h-4 w-4" /> Recent Operations ({ops.length})
          </h3>
          <div className="space-y-2.5 overflow-y-auto pr-1">
            {ops.map((op) => (
              <div key={op.id} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {op.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-sentio-text-muted mt-0.5">{timeAgo(op.created_at)}</p>
                </div>
                <a
                  href={`https://stellar.expert/explorer/public/op/${op.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 ml-2 p-2 rounded-lg bg-white/5 text-sentio-text-muted hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counterparties + Operation Breakdown */}
      {scanResult && (scanResult.counterparties || scanResult.operationBreakdown) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Counterparty viewer */}
          {scanResult.counterparties && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <Users className="h-4 w-4" /> Counterparty Analysis
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Total", value: scanResult.counterparties.total },
                  { label: "Unique", value: scanResult.counterparties.unique },
                  { label: "Verified", value: scanResult.counterparties.knownVerified },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-3 text-center">
                    <p className="text-[0.6rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                ))}
              </div>
              {scanResult.counterparties.unique > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-sentio-text-muted">Verified ratio</span>
                    <span className="font-mono text-foreground">
                      {Math.round((scanResult.counterparties.knownVerified / scanResult.counterparties.unique) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-sentio-success"
                      style={{ width: `${Math.round((scanResult.counterparties.knownVerified / scanResult.counterparties.unique) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Operation-type breakdown */}
          {scanResult.operationBreakdown && Object.keys(scanResult.operationBreakdown).length > 0 && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Operation Types
              </h3>
              <div className="space-y-2.5">
                {Object.entries(scanResult.operationBreakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => {
                    const total = Object.values(scanResult.operationBreakdown!).reduce((s, v) => s + v, 0);
                    const pct = Math.round((count / total) * 100);
                    const isSoroban = type === "invoke_host_function";
                    return (
                      <div key={type}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className={`capitalize ${isSoroban ? "text-sentio-warning font-semibold" : "text-sentio-text-secondary"}`}>
                            {type.replace(/_/g, " ")}
                            {isSoroban && " \u26a1"}
                          </span>
                          <span className="font-mono text-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${isSoroban ? "bg-sentio-warning" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEX Exposure + Claimable Balances */}
      {scanResult && (scanResult.dexExposure || scanResult.claimableBalances) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* DEX exposure */}
          {scanResult.dexExposure && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> DEX Exposure
              </h3>
              <div className="flex items-end gap-3 mb-4">
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {scanResult.dexExposure.openOffers}
                </p>
                <p className="text-sm text-sentio-text-muted mb-1">open offers</p>
              </div>
              {scanResult.dexExposure.offerAssets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scanResult.dexExposure.offerAssets.map((asset) => (
                    <span key={asset} className="inline-flex rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
                      {asset}
                    </span>
                  ))}
                </div>
              )}
              {scanResult.dexExposure.openOffers === 0 && (
                <p className="text-sm text-sentio-text-muted">No open DEX offers detected.</p>
              )}
            </div>
          )}

          {/* Claimable balances */}
          {scanResult.claimableBalances && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <Gift className="h-4 w-4" /> Claimable Balances
              </h3>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {scanResult.claimableBalances.count}
                </p>
                <p className="text-sm text-sentio-text-muted mb-1">pending claims</p>
              </div>
              {scanResult.claimableBalances.count >= 8 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-sentio-warning/20 bg-sentio-warning/8 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentio-warning" />
                  <p className="text-xs text-sentio-warning">High claimable balance count may indicate airdrop farming behavior.</p>
                </div>
              )}
              {scanResult.claimableBalances.count === 0 && (
                <p className="text-sm text-sentio-text-muted mt-2">No pending claimable balances.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Asset Result Panel ────────────────────────────────────────────────────────

interface AssetPanelProps {
  asset: HorizonAsset;
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
  scanResult: ScanResult | null;
}

function AssetPanel({ asset, onchainHistory, onchainFlags, scanResult }: AssetPanelProps) {
  const totalSupply = parseFloat(asset.balances?.authorized ?? "0")
    + parseFloat(asset.balances?.authorized_to_maintain_liabilities ?? "0");

  return (
    <div className="space-y-4">
      <EngineRiskCard scan={scanResult} />
      {scanResult?.breakdown && <ScanBreakdownCard breakdown={scanResult.breakdown} />}
      <RiskScoreCard onchainHistory={onchainHistory} />
      <FlagBanner flags={onchainFlags} />

      {/* Identity */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary uppercase">
                {asset.asset_code.slice(0, 2)}
              </div>
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  {asset.asset_code}
                  <span className="inline-flex rounded-full bg-white/10 text-sentio-text-secondary px-2.5 py-1 text-xs font-semibold tracking-wide uppercase self-center translate-y-0.5">
                    {asset.asset_type.replace("_", " ")}
                  </span>
                </h2>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 bg-black/40 rounded-xl p-4 border border-white/5 w-full">
              <span className="text-xs font-semibold uppercase tracking-widest text-sentio-text-muted whitespace-nowrap">Issuer:</span>
              <div className="flex flex-1 items-center gap-2 overflow-hidden w-full">
                <span className="font-mono text-sm text-white truncate flex-1" title={asset.asset_issuer}>
                  {asset.asset_issuer}
                </span>
                <div className="flex shrink-0">
                  <CopyButton text={asset.asset_issuer} />
                  <a
                    href={`https://stellar.expert/explorer/public/asset/${asset.asset_code}-${asset.asset_issuer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 flex p-1.5 rounded-md text-sentio-text-muted hover:text-white transition-colors hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          {asset._links?.toml?.href && (
            <a
              href={asset._links.toml.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <Globe className="h-4 w-4" />
              View stellar.toml
            </a>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Users,   label: "Authorized Holders", value: fmt(asset.accounts?.authorized ?? 0, 0) },
            { icon: TrendingUp, label: "Total Supply",    value: fmt(totalSupply, 2) },
            { icon: Layers,  label: "Liquidity Pools",    value: `${asset.num_liquidity_pools ?? 0}` },
            { icon: Shield,  label: "Claimable Balances", value: `${asset.num_claimable_balances ?? 0}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-sentio-text-muted" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Protocol Flags */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Shield className="h-4 w-4" /> Asset Protocol Flags
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(asset.flags).map(([k, v]) => (
              <Tooltip key={k}>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-help transition-colors ${
                    v
                      ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                      : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
                  }`}>
                    {k.replace(/_/g, " ")} {v ? "✓" : "✗"}
                    <Info className="h-3 w-3 opacity-60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  {FLAG_DESCRIPTIONS[k] ?? "No description available."}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Balance breakdown */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Coins className="h-4 w-4" /> Balance Exposure
          </h3>
          <div className="space-y-3">
            {[
              { label: "Authorized",               value: asset.balances?.authorized ?? "0",                            holders: asset.accounts?.authorized ?? 0,                            ok: true },
              { label: "Auth. to Maintain Liab.",  value: asset.balances?.authorized_to_maintain_liabilities ?? "0",   holders: asset.accounts?.authorized_to_maintain_liabilities ?? 0,   ok: true },
              { label: "Unauthorized",             value: asset.balances?.unauthorized ?? "0",                         holders: asset.accounts?.unauthorized ?? 0,                         ok: false },
            ].map((row) => (
              <div key={row.label} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${row.ok ? "border-foreground/5 bg-sentio-surface/30" : "border-sentio-danger/20 bg-sentio-danger/5"}`}>
                <div className="font-medium text-sm">
                  <span className={row.ok ? "text-sentio-text-secondary" : "text-sentio-danger flex items-center gap-1"}>
                    {!row.ok && <AlertCircle className="h-3.5 w-3.5" />} {row.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold">{parseFloat(row.value).toFixed(2)}</p>
                  <p className="text-[0.65rem] text-sentio-text-muted uppercase tracking-wider font-bold mt-0.5">{row.holders.toLocaleString()} accounts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(onchainFlags.length > 0 || onchainHistory.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {onchainFlags.length > 0 && <OnchainFlagsCard flags={onchainFlags} />}
          {onchainHistory.length > 0 && <OnchainHistoryCard history={onchainHistory} />}
        </div>
      )}
    </div>
  );
}

// ─── Contract Panel ────────────────────────────────────────────────────────────

function ContractPanel({ result }: { result: ContractScanResult }) {
  const { label, color, bg, border } = deriveRiskLabel(result.score);
  const activeFlags = Object.entries(result.riskBreakdown ?? {})
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);

  return (
    <div className="space-y-4">
      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border ${border} ${bg} p-5`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sentio-text-muted mb-1">Contract Risk Analysis</p>
            <p className={`text-4xl font-bold tabular-nums ${color}`}>
              {result.score}<span className="text-lg text-sentio-text-muted font-medium">/100</span>
            </p>
            <p className={`mt-1 text-sm font-semibold ${color}`}>{label}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex rounded-lg border border-foreground/10 bg-sentio-surface/50 px-2.5 py-1 text-xs font-bold text-foreground capitalize">
              {result.risk}
            </span>
            <p className="text-xs text-sentio-text-muted mt-2">Confidence: {result.confidence}%</p>
          </div>
        </div>

        {/* Risk breakdown flags */}
        {activeFlags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeFlags.map((f) => (
              <span key={f} className="inline-flex rounded-md border border-sentio-danger/30 bg-sentio-danger/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-sentio-danger">
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Insight callout */}
        {result.insights && result.insights.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {result.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/8 px-4 py-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-sentio-text-secondary leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {result.recommendation && (
          <div className="mt-3 rounded-xl border border-foreground/8 bg-black/20 px-4 py-3 text-sm text-sentio-text-secondary">
            <span className="font-semibold text-foreground">Recommendation:</span> {result.recommendation}
          </div>
        )}
      </motion.div>

      {/* Identity + summary */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <FileCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="inline-flex rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase">Soroban Contract</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <p className="font-mono text-sm break-all text-white flex-1">{result.contractId}</p>
          <CopyButton text={result.contractId} />
          <a
            href={`https://stellar.expert/explorer/public/contract/${result.contractId}`}
            target="_blank" rel="noopener noreferrer"
            className="p-1.5 text-sentio-text-muted hover:text-white transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        {result.summary && (
          <p className="text-sm text-sentio-text-secondary">{result.summary}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Activity,   label: "Invocations",     value: result.behavior.invocationCount.toLocaleString() },
            { icon: Users,      label: "Unique Callers",  value: result.behavior.uniqueCallers.toLocaleString() },
            { icon: TrendingUp, label: "Events",          value: result.behavior.eventCount.toLocaleString() },
            { icon: Clock,      label: "Age (days)",      value: result.metadata.ageDays != null ? String(result.metadata.ageDays) : "Unknown" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-sentio-text-muted" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Behavior + events */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Dominant caller ratio */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
            <Users className="h-4 w-4" /> Caller Concentration
          </h3>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {(result.behavior.dominantCallerRatio * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-sentio-text-muted mb-1">of invocations from single caller</p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10">
            <div
              className={`h-2 rounded-full ${
                result.behavior.dominantCallerRatio > 0.8 ? "bg-sentio-danger" :
                result.behavior.dominantCallerRatio > 0.5 ? "bg-sentio-warning" : "bg-sentio-success"
              }`}
              style={{ width: `${Math.min(100, result.behavior.dominantCallerRatio * 100)}%` }}
            />
          </div>
          {result.metadata.deployer && (
            <div className="mt-4 flex items-center gap-2 text-xs text-sentio-text-muted">
              <span className="font-semibold uppercase tracking-wider">Deployer:</span>
              <span className="font-mono truncate">{shortAddress(result.metadata.deployer)}</span>
              <CopyButton text={result.metadata.deployer} />
            </div>
          )}
        </div>

        {/* Event categories */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
            <Layers className="h-4 w-4" /> Event Categories
          </h3>
          {Object.keys(result.events?.categories ?? {}).length === 0 ? (
            <p className="text-sm text-sentio-text-muted">No events recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(result.events.categories).map(([cat, count]) => {
                const total = result.behavior.eventCount || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-sentio-text-secondary capitalize">{cat.replace(/_/g, " ")}</span>
                      <span className="font-mono text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* On-chain risk history if available */}
      {result.onchainRiskData && (
        <RiskScoreCard onchainHistory={[result.onchainRiskData]} />
      )}
    </div>
  );
}

// ─── Main Explorer Page ────────────────────────────────────────────────────────

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; isRateLimit?: boolean; retryAfter?: number }
  | {
      status: "done";
      mode: "account" | "asset" | "contract";
      account?: HorizonAccount;
      asset?: HorizonAsset;
      contractResult?: ContractScanResult;
      txns: HorizonTransaction[];
      ops: HorizonOperation[];
      onchainHistory: OnchainRisk[];
      onchainFlags: OnchainFlag[];
      scanResult: ScanResult | null;
      ledger: LedgerStats | null;
    };

export default function Explorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setSearchParams({ q: trimmed }, { replace: true });
    setState({ status: "loading" });

    // Contract ID: starts with C, 56 chars
    const isContract = /^C[A-Z2-7]{55}$/.test(trimmed);

    try {
      if (isContract) {
        const res = await fetch("/api/scan/contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: trimmed }),
        });
        if (res.status === 429) {
          const ra = parseInt(res.headers.get("Retry-After") || "60", 10);
          setState({ status: "error", message: "Too many requests", isRateLimit: true, retryAfter: ra });
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Contract scan failed." }));
          throw new Error(err.error ?? "Contract scan failed.");
        }
        const contractResult: ContractScanResult = await res.json();
        setState({
          status: "done", mode: "contract",
          contractResult,
          txns: [], ops: [], onchainHistory: [], onchainFlags: [], scanResult: null, ledger: null,
        });
        return;
      }

      const { mode, account, asset } = await searchStellar(trimmed);
      let txns: HorizonTransaction[] = [];
      let ops: HorizonOperation[] = [];

      if (mode === "account" && account) {
        [txns, ops] = await Promise.all([
          fetchAccountTransactions(account.account_id, 10),
          fetchAccountOperations(account.account_id, 10),
        ]);
      } else if (!asset) {
        throw new Error("No results found.");
      }

      const addressToFetch = mode === "account" && account
        ? account.account_id
        : asset ? `${asset.asset_code}:${asset.asset_issuer}` : "";

      let onchainHistory: OnchainRisk[] = [];
      let onchainFlags: OnchainFlag[] = [];
      let scanResult: ScanResult | null = null;
      let ledger: LedgerStats | null = null;

      if (addressToFetch) {
        try {
          const scanReq = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
          });

          if (scanReq.status === 429) {
            const ra = parseInt(scanReq.headers.get("Retry-After") || "60", 10);
            setState({ status: "error", message: "Too many requests", isRateLimit: true, retryAfter: ra });
            return;
          }

          const scanResPromise = scanReq.ok ? scanReq.json() : null;

          const [histRes, flagsRes, scanRes, ledgerRes] = await Promise.all([
            fetch(`/api/registry/history/${addressToFetch}`).then(r => r.ok ? r.json() : { history: [] }),
            fetch(`/api/registry/flags/${addressToFetch}`).then(r => r.ok ? r.json() : { flags: [] }),
            scanResPromise,
            fetchLatestLedger(),
          ]);
          onchainHistory = histRes.history || [];
          onchainFlags   = flagsRes.flags  || [];
          scanResult     = scanRes;
          ledger         = ledgerRes;
        } catch {
          console.warn("Failed to fetch onchain or scan data");
        }
      }

      setState({ status: "done", mode, account, asset, txns, ops, onchainHistory, onchainFlags, scanResult, ledger });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [setSearchParams]);

  // Auto-search on mount if URL has a query param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) handleSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setState({ status: "idle" });
    setQuery("");
    setSearchParams({}, { replace: true });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Live stream — only for account searches
  const liveAccountId = state.status === "done" && state.mode === "account" && state.account
    ? state.account.account_id
    : null;

  const { status: streamStatus, lastTxId } = useLiveStream(
    liveAccountId,
    useCallback((patch: Partial<ScanResult>) => {
      setState((prev) => {
        if (prev.status !== "done") return prev;
        return { ...prev, scanResult: prev.scanResult ? { ...prev.scanResult, ...patch } : prev.scanResult };
      });
    }, []),
  );

  const isDone    = state.status === "done";
  const isLoading = state.status === "loading";

  return (
    <PageLayout>
      <header className="flex items-center justify-between gap-4 py-5 mb-4">
        <BrandMark to="/" size="lg" />
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      <div className="mb-8 animate-fade-in-up md:text-center md:flex md:flex-col md:items-center">
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Stellar Explorer
        </span>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Scan any <strong>account</strong>,{" "}
          <span className="bg-linear-to-r from-accent to-primary bg-clip-text font-bold text-transparent">
            asset
          </span>
          {" "}or contract
        </h1>
        <p className="text-body-lg mt-4 max-w-lg">
          Enter a Stellar account address, asset code, or Soroban contract ID to retrieve on-chain details and risk assessment.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-10 max-w-2xl mx-auto">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
          className="flex flex-col sm:flex-row gap-2 shadow-sentio-lg rounded-2xl"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sentio-text-muted" />
            <input
              ref={inputRef}
              id="explorer-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="GXXXXXX... or USDC or CXXXXXX... (contract)"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-foreground/10 bg-sentio-surface/80 py-4 pl-12 pr-4 font-mono text-sm sm:text-base text-foreground placeholder-sentio-text-muted backdrop-blur-md outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/20 shadow-inner"
            />
          </div>
          <button
            id="explorer-scan-btn"
            type="submit"
            disabled={!query.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-sm sm:text-base font-bold text-primary-foreground transition hover:opacity-90 hover:shadow-sentio-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <><RefreshCw className="h-5 w-5 animate-spin" />Searching…</>
            ) : (
              <><Search className="h-5 w-5" />Search</>
            )}
          </button>
        </form>

        {/* Example hints */}
        {state.status === "idle" && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              { label: "Example account",  value: "GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX" },
              { label: "USDC asset",       value: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
              { label: "XLM (native)",    value: "XLM" },
              { label: "Contract scan",   value: "CBIELTK6YBZJU5UP2WWQEUCYKSCVI3OLFBIUWA4REBDWRGXCF4J2L4G3" },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => { setQuery(value); handleSearch(value); }}
                className="rounded-xl border border-foreground/8 bg-sentio-surface/50 px-3 py-2 text-xs text-sentio-text-muted transition hover:text-foreground hover:bg-white/5 active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results & Errors */}
      <AnimatePresence mode="wait">
        {state.status === "error" && (
          state.isRateLimit ? (
            <RateLimitCountdown 
              key="ratelimit"
              retryAfter={state.retryAfter ?? 60} 
              onDismiss={reset} 
            />
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-8 mx-auto max-w-2xl flex items-start gap-4 rounded-2xl border border-sentio-danger/30 bg-sentio-danger/10 p-5 shadow-sentio-md"
            >
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-sentio-danger" />
              <div className="flex-1">
                <p className="text-base font-bold text-sentio-danger">Search failed</p>
                <p className="mt-1 text-sm text-sentio-danger/90">{state.message}</p>
              </div>
              <button
                onClick={reset}
                className="text-xs font-semibold uppercase tracking-wider text-sentio-text-muted hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
              >
                Dismiss
              </button>
            </motion.div>
          )
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mt-8 w-full"
          >
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            </div>
          </motion.div>
        )}

        {isDone && state.status === "done" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-5xl mx-auto mt-8 w-full"
          >
            {/* Network ledger bar + stream status — account/asset only */}
            {state.mode !== "contract" && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/8 bg-sentio-surface/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-sentio-text-muted">
                  {state.ledger ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sentio-success inline-block" />
                        Ledger <span className="font-mono font-bold text-foreground">#{state.ledger.sequence.toLocaleString()}</span>
                      </span>
                      <span>TXs: <strong className="text-foreground">{state.ledger.successful_transaction_count}</strong></span>
                      <span>Base fee: <strong className="text-foreground">{state.ledger.base_fee_in_stroops} stroops</strong></span>
                    </>
                  ) : (
                    <span className="text-sentio-text-muted">Network stats unavailable</span>
                  )}
                </div>
                {state.mode === "account" && (
                  <div className="flex items-center gap-2">
                    {streamStatus === "live" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-sentio-success/30 bg-sentio-success/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-sentio-success">
                        <Wifi className="h-3 w-3" />
                        Live
                        <span className="h-1.5 w-1.5 rounded-full bg-sentio-success animate-pulse" />
                      </span>
                    )}
                    {streamStatus === "stopped" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-sentio-text-muted">
                        <WifiOff className="h-3 w-3" />
                        Stream ended
                      </span>
                    )}
                    {lastTxId && (
                      <span className="text-[0.6rem] text-sentio-text-muted font-mono">
                        last tx: {lastTxId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {state.mode === "account" && state.account && (
              <AccountPanel
                account={state.account}
                txns={state.txns}
                ops={state.ops}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
                scanResult={state.scanResult}
                isLive={streamStatus === "live"}
              />
            )}
            {state.mode === "asset" && state.asset && (
              <AssetPanel
                asset={state.asset}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
                scanResult={state.scanResult}
              />
            )}
            {state.mode === "contract" && state.contractResult && (
              <ContractPanel result={state.contractResult} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}

function RateLimitCountdown({ retryAfter, onDismiss }: { retryAfter: number; onDismiss: () => void }) {
  const [timeLeft, setTimeLeft] = useState(retryAfter);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <motion.div
      key="error"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mb-8 mx-auto max-w-2xl flex items-start gap-4 rounded-2xl border border-sentio-warning/30 bg-sentio-warning/10 p-5 shadow-sentio-md"
    >
      <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-sentio-warning" />
      <div className="flex-1">
        <p className="text-base font-bold text-sentio-warning">Too many requests</p>
        <p className="mt-1 text-sm text-sentio-warning/90">
          {timeLeft > 0 ? `Please wait ${timeLeft}s before trying again.` : "You can try searching again."}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs font-semibold uppercase tracking-wider text-sentio-warning hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
      >
        Dismiss
      </button>
    </motion.div>
  );
}
