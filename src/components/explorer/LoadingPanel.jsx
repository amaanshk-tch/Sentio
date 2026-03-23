import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Card } from "../../ui/Card";

export function LoadingPanel() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-11 w-11">
            <motion.div
              className="absolute inset-0 rounded-full border border-white/[0.08]"
              animate={{ opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-fuchsia-400"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-sentio-text">Analyzing ledger data</p>
            <p className="mt-0.5 text-xs text-sentio-text-muted">Scoring heuristics, flags, and identity signals</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-sentio-elevated/60 px-3 py-1.5 text-xs font-medium text-sentio-text-secondary sm:flex">
          <Zap className="h-3.5 w-3.5 text-sentio-accent" aria-hidden />
          Horizon + policy checks
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-sentio-xl border border-white/[0.06] bg-sentio-elevated/35 p-5 ring-1 ring-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="sentio-shimmer h-11 w-11 rounded-xl ring-1 ring-white/[0.06]" />
                <div className="space-y-2 pt-0.5">
                  <div className="sentio-shimmer h-3 w-28 rounded-md" />
                  <div className="sentio-shimmer h-6 w-20 rounded-md" />
                </div>
              </div>
              <div className="sentio-shimmer h-6 w-[4.5rem] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
