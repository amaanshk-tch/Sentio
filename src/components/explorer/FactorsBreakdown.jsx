import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/cn";

const impactColor = (impact) =>
  impact < 0
    ? "bg-rose-500"
    : impact > 0
      ? "bg-emerald-500"
      : "bg-white/20";

const impactText = (impact) =>
  impact < 0
    ? "text-rose-300"
    : impact > 0
      ? "text-emerald-300"
      : "text-sentio-text-muted";

export function FactorsBreakdown({ factors }) {
  if (!factors?.length) return null;

  const maxImpact = Math.max(...factors.map((f) => Math.abs(f.impact)));

  return (
    <div className="space-y-2.5">
      <AnimatePresence mode="popLayout">
        {factors.map((f, i) => {
          const barPct = maxImpact > 0 ? Math.abs(f.impact) / maxImpact : 0;
          return (
            <motion.div
              key={f.label}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3"
            >
              <span
                className={cn(
                  "shrink-0 w-10 text-right text-xs font-semibold tabular-nums",
                  impactText(f.impact)
                )}
              >
                {f.impact > 0 ? `+${f.impact}` : f.impact === 0 ? "—" : f.impact}
              </span>

              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                <motion.div
                  className={cn("absolute inset-y-0 left-0 rounded-full", impactColor(f.impact))}
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct * 100}%` }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                />
              </div>

              <span className="min-w-0 flex-2 text-xs leading-snug text-sentio-text-secondary">
                {f.label}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
