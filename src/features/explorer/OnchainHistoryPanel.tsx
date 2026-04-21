import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { timeAgo } from "./utils";
import type { OnchainRisk, OnchainFlag } from "./utils";

export function FlagBanner({ flags }: { flags: OnchainFlag[] }) {
  const [now] = useState(() => Date.now());
  const recentFlags = flags.filter(f => (now - f.timestamp) <= 24 * 60 * 60 * 1000);
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

export function OnchainFlagsCard({ flags }: { flags: OnchainFlag[] }) {
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

export function OnchainHistoryCard({ history }: { history: OnchainRisk[] }) {
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
