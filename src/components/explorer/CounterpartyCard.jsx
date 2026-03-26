import { motion } from "framer-motion";
import { Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";

export function CounterpartyCard({ counterparties }) {
  if (!counterparties) return null;
  const { total, unique, knownVerified } = counterparties;
  const unknown = unique - knownVerified;
  const pctVerified = unique > 0 ? Math.round((knownVerified / unique) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-sentio-xl border border-white/8 bg-white/3 p-5 backdrop-blur-md"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/12 ring-1 ring-violet-500/25">
          <Users className="h-4 w-4 text-violet-300" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sentio-text-muted">
            Counterparties
          </p>
          <p className="text-[0.65rem] text-sentio-text-subtle">
            From last {total} operation{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums tracking-tight text-sentio-text">{unique}</p>
          <p className="text-[0.58rem] text-sentio-text-subtle">Unique</p>
        </div>
        <div className="h-8 w-px bg-white/8" />
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          <span className="text-sm font-semibold tabular-nums text-emerald-300">{knownVerified}</span>
          <span className="text-[0.6rem] text-sentio-text-subtle">verified</span>
        </div>
        <div className="h-8 w-px bg-white/8" />
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <span className={cn("text-sm font-semibold tabular-nums", unknown > 5 ? "text-amber-300" : "text-sentio-text-secondary")}>
            {unknown}
          </span>
          <span className="text-[0.6rem] text-sentio-text-subtle">unknown</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[0.58rem] text-sentio-text-subtle">
          <span>Verified ratio</span>
          <span>{pctVerified}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${pctVerified}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}
