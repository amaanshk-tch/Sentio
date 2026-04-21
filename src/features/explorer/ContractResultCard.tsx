import { motion } from "framer-motion";
import { Info, FileCode, ExternalLink, Activity, Users, TrendingUp, Clock, Layers } from "lucide-react";
import { shortAddress } from "./utils";
import type { ContractScanResult } from "./utils";
import { CopyButton } from "./Shared";
import { RiskScoreCard } from "./ScanResultCard";

export function ContractResultCard({ result }: { result: ContractScanResult }) {
  const contractRiskStyle = {
    "Low Risk":    { color: "text-sentio-success",  bg: "bg-sentio-success/10",  border: "border-sentio-success/30" },
    "Medium Risk": { color: "text-sentio-warning",  bg: "bg-sentio-warning/10",  border: "border-sentio-warning/30" },
    "High Risk":   { color: "text-sentio-danger",   bg: "bg-sentio-danger/10",   border: "border-sentio-danger/30" },
  };
  const style = contractRiskStyle[result.risk as keyof typeof contractRiskStyle] 
    ?? contractRiskStyle["High Risk"];
  const { color, bg, border } = style;
  const label = result.risk;

  const activeFlags = Object.entries(result.riskBreakdown ?? {})
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);

  return (
    <div className="space-y-4">
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

        {activeFlags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeFlags.map((f) => (
              <span key={f} className="inline-flex rounded-md border border-sentio-danger/30 bg-sentio-danger/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-sentio-danger">
                {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

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

        {result.recommendation && (
          <div className="mt-3 rounded-xl border border-foreground/8 bg-black/20 px-4 py-3 text-sm text-sentio-text-secondary">
            <span className="font-semibold text-foreground">Recommendation:</span> {result.recommendation}
          </div>
        )}
      </motion.div>

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
            href={`https://stellar.expert/explorer/${result.network === "mainnet" ? "public" : "testnet"}/contract/${result.contractId}`}
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

      <div className="grid lg:grid-cols-2 gap-4">
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

      {result.onchainRiskData && (
        <RiskScoreCard onchainHistory={[result.onchainRiskData]} />
      )}
    </div>
  );
}
