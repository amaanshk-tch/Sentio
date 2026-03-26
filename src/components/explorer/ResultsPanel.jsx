import { motion } from "framer-motion";
import { AlertTriangle, CircleDot, Globe, Shield } from "lucide-react";
import { cn } from "../../lib/cn";
import { RiskGauge } from "./RiskGauge";
import { colorClasses, scoreColor, truncateMiddle } from "./utils";

function Pill({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium text-sentio-text-secondary">
      <Icon className="h-3.5 w-3.5 text-sentio-text-muted" aria-hidden />
      {label}
    </span>
  );
}

export function ResultsPanel({ result }) {
  const tone = scoreColor(result.score);
  const classes = colorClasses(tone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-sentio-2xl border border-violet-500/25 bg-(--surface-highlight) p-6 shadow-sentio-md ring-1 ring-white/4 backdrop-blur-xl sm:p-8"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-sentio-text-muted">Primary result</p>
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold",
            classes.badge
          )}
        >
          {result.risk}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-10">
        <div className="flex justify-center lg:justify-start">
          <RiskGauge score={result.score} />
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-caption text-sentio-text-muted">Target</p>
            <p className="mt-2 break-all font-mono text-sm font-medium leading-snug text-sentio-text sm:text-base">
              {truncateMiddle(result.address, 14, 12)}
            </p>
            <div className="mt-3 inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-sentio-elevated/80 px-2.5 py-1 text-xs font-medium text-sentio-text-secondary">
                <CircleDot className="h-3.5 w-3.5 text-sentio-accent" aria-hidden />
                {result.isAsset ? "Asset" : "Account"}
              </span>
            </div>
          </div>

          <div className="border-t border-white/8 pt-6">
            <p className="text-caption text-sentio-text-muted">Top signals</p>
            <ul className="mt-3 space-y-2.5 text-sm font-medium leading-relaxed text-sentio-text-secondary">
              {result.reasons.slice(0, 3).map((r) => (
                <li key={r} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-violet-400 to-cyan-300" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill icon={AlertTriangle} label="Heuristics" />
            <Pill icon={Shield} label="Policy" />
            <Pill icon={Globe} label="Domain" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
