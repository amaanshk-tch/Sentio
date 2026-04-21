import { motion } from "framer-motion";
import { AlertTriangle, Shield, ArrowUpRight, ArrowDownRight, Minus, Share2, Info } from "lucide-react";
import {
  deriveRiskLabel,
  getTrustBadge,
  getHistoryComparison,
  levelBadge,
  timeAgo
} from "./utils";
import type { OnchainRisk, ScanResult, ScanRiskFactors } from "./utils";

export function RiskScoreCard({ onchainHistory, scanResult }: { onchainHistory: OnchainRisk[]; scanResult?: ScanResult | null }) {
  if (onchainHistory.length === 0) return null;
  const latest = onchainHistory[0];
  const { label, color, bg, border } = deriveRiskLabel(latest.score);
  const badge = getTrustBadge(latest.score);
  const historyComparison = getHistoryComparison(onchainHistory);

  const reasons = scanResult?.reasons?.length
    ? scanResult.reasons
    : scanResult?.contributions?.length
      ? scanResult.contributions.slice(0, 4).map((contribution) => `${contribution.label} (${contribution.impact.toFixed(1)})`)
      : [
        historyComparison
          ? `Latest saved checkpoint was recorded ${historyComparison.previousAgo}.`
          : "Score is based on real on-chain registry history, transaction patterns, and trust signals.",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 rounded-2xl border ${border} ${bg} p-5`}
    >
      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sentio-text-muted mb-1">Risk Assessment</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className={`text-5xl font-bold tabular-nums ${color}`}>
              {latest.score}
              <span className="text-lg text-sentio-text-muted font-medium">/100</span>
            </p>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badge.style}`}>
              {badge.type === "alert" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
              {badge.label}
            </span>
          </div>
          <p className={`mt-2 text-sm font-semibold ${color}`}>{label}</p>
          <p className="mt-1 text-sm text-sentio-text-muted">{badge.description}</p>
          <p className="text-xs text-sentio-text-muted mt-3">Confidence: {latest.confidence}%</p>
          <p className="text-xs text-sentio-text-muted mt-1">Updated {timeAgo(new Date(latest.last_updated).toISOString())}</p>
          <div className="mt-4">
            <a
              href="/#how-it-works"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sentio-text-muted hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              How is this score calculated?
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-sentio-surface/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted mb-3">Visual risk gauge</p>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-linear-to-r from-sentio-success via-sentio-warning to-sentio-danger"
              style={{ width: `${Math.min(100, Math.max(0, latest.score))}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[0.65rem] uppercase tracking-wider text-sentio-text-muted">
            <span>0 safe</span>
            <span>100 risky</span>
          </div>
          {historyComparison ? (
            <div className="mt-4 rounded-2xl border border-foreground/10 bg-background/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sentio-text-muted mb-2">History snapshot</p>
              <div className="flex items-center justify-between gap-3 text-sm text-foreground">
                <div>
                  <p className="font-semibold">{historyComparison.trend === "safer" ? "Safer than before" : historyComparison.trend === "riskier" ? "Riskier than before" : "Stable risk"}</p>
                  <p className="text-xs text-sentio-text-muted">Compared to {historyComparison.previousAgo}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[0.65rem] font-bold uppercase ${historyComparison.delta > 0 ? "border-sentio-danger/20 bg-sentio-danger/10 text-sentio-danger" : historyComparison.delta < 0 ? "border-sentio-success/20 bg-sentio-success/10 text-sentio-success" : "border-foreground/10 bg-foreground/5 text-sentio-text-muted"}`}>
                  {historyComparison.delta > 0 ? "+" : ""}{historyComparison.delta}
                </span>
              </div>
              <div className="mt-3 flex justify-between text-xs text-sentio-text-muted">
                <span>{historyComparison.previous.score}/100</span>
                <span>{latest.score}/100</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-sentio-text-muted">No prior saved checkpoint available. History trend loads once there are at least two registry entries.</p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-foreground/10 bg-sentio-surface/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted mb-3">Why this score?</p>
          <ul className="space-y-2 text-sm text-foreground">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-sentio-surface/70 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted mb-3">Risk logic</p>
          <div className="space-y-2 text-sm text-foreground">
            <p>Score is grounded in actual on-chain signals: account behavior, transaction patterns, trustline exposure, and registry history.</p>
            <p>Historical risk data is preserved on-chain and compared against the latest saved entry to answer “Was this safer before?”.</p>
            <p>Trust badges are derived from numeric thresholds, so you get consistent verdicts like Verified Safe and High Risk.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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

export function RiskFactorPills({ riskFactors }: { riskFactors: ScanRiskFactors }) {
  const active: { key: string; label: string; variant: "danger" | "warning" | "muted" }[] = [];

  for (const [key, meta] of Object.entries(RISK_FACTOR_META)) {
    const val = riskFactors[key as keyof ScanRiskFactors];
    if (val) active.push({ key, ...meta });
  }
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

export function EngineRiskCard({ scan, isLive }: { scan: ScanResult | null; isLive?: boolean }) {
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
          <div className="mt-3">
            <a
              href="/#how-it-works"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sentio-text-muted hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              How is this score calculated?
            </a>
          </div>
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
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-sentio-surface/50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-sentio-text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
        </div>
      </div>

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

      {scan.insight && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-sentio-text-secondary leading-relaxed">{scan.insight}</p>
        </div>
      )}
    </motion.div>
  );
}
