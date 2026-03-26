import { motion } from "framer-motion";
import { AlertTriangle, CircleDot, Radio, Terminal, Users, Blocks, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { RiskGauge } from "./RiskGauge";
import { FactorsBreakdown } from "./FactorsBreakdown";
import { colorClasses, scoreColor, truncateMiddle } from "./utils";

export function ContractPanel({ result }) {
  const { score, risk, flags, metadata, behavior, riskBreakdown, contractId } = result;

  const typeColor =
    metadata.contractType === "Token" || metadata.contractType === "DEX" || metadata.contractType === "NFT-like"
      ? "text-cyan-300 border-cyan-400/25 bg-cyan-500/12"
      : "text-sentio-text-secondary border-white/10 bg-white/5";

  const tone    = scoreColor(score);
  const classes = colorClasses(tone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-sentio-2xl border border-violet-500/25 bg-(--surface-highlight) p-6 shadow-sentio-md ring-1 ring-white/4 backdrop-blur-xl sm:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-caption text-sentio-text-muted">Contract Scan</p>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider", typeColor)}>
             {metadata.contractType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold", classes.badge)}>
            {risk}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-10">
        <div className="flex justify-center lg:justify-start">
          <RiskGauge score={score} trend={result.trend?.direction} live={false} />
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-caption text-sentio-text-muted">Contract ID</p>
            <p className="mt-2 break-all font-mono text-sm font-medium leading-snug text-sentio-text sm:text-base">
              {truncateMiddle(contractId, 16, 16)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 border-y border-white/8 py-5">
             <div className="space-y-1.5">
               <div className="flex items-center gap-1.5 text-sentio-text-muted">
                 <Terminal className="h-3 w-3" />
                 <span className="text-[0.65rem] uppercase tracking-wide font-semibold">Calls</span>
               </div>
               <p className="text-lg font-bold tabular-nums text-sentio-text">{behavior.invocationCount}</p>
             </div>
             <div className="space-y-1.5">
               <div className="flex items-center gap-1.5 text-sentio-text-muted">
                 <Users className="h-3 w-3" />
                 <span className="text-[0.65rem] uppercase tracking-wide font-semibold">Users</span>
               </div>
               <p className="text-lg font-bold tabular-nums text-sentio-text">{behavior.uniqueCallers}</p>
             </div>
             <div className="space-y-1.5">
               <div className="flex items-center gap-1.5 text-sentio-text-muted">
                 <Blocks className="h-3 w-3" />
                 <span className="text-[0.65rem] uppercase tracking-wide font-semibold">Events</span>
               </div>
               <p className="text-lg font-bold tabular-nums text-sentio-text">{behavior.eventCount}</p>
             </div>
             <div className="space-y-1.5">
               <div className="flex items-center gap-1.5 text-sentio-text-muted">
                 <Clock className="h-3 w-3" />
                 <span className="text-[0.65rem] uppercase tracking-wide font-semibold">Age</span>
               </div>
               <p className="text-sm font-bold text-sentio-text mt-1">{metadata.ageDays != null ? `${metadata.ageDays}d` : "N/A"}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-caption text-sentio-text-muted mb-3">Deployer Status</p>
              <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-sm">
                 {metadata.deployer?.deployerDomainVerified ? (
                   <div className="flex items-start gap-2.5">
                     <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                     <div>
                       <p className="font-semibold text-emerald-300">{metadata.deployer.homeDomain}</p>
                       <p className="text-xs text-sentio-text-subtle mt-0.5">Known verified entity</p>
                     </div>
                   </div>
                 ) : (
                   <div className="flex items-start gap-2.5">
                     <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                     <div>
                       <p className="font-semibold text-sentio-text-secondary">Unverified Source</p>
                       <p className="text-xs text-sentio-text-subtle mt-0.5">Deployer has no stellar.toml</p>
                     </div>
                   </div>
                 )}
              </div>
            </div>

            <div>
              <p className="text-caption text-sentio-text-muted mb-3">Score Factors</p>
              <div className="rounded-xl border border-white/8 bg-white/4 p-4 min-h-[76px]">
                {riskBreakdown?.length > 0 ? (
                  <FactorsBreakdown factors={riskBreakdown} />
                ) : (
                  <p className="text-sm text-sentio-text-muted">No extreme signals detected.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
