import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/cn";

export function InsightPanel({ text, score }) {
  const severity = score >= 70 ? "ok" : score >= 40 ? "warn" : "bad";
  const styles =
    severity === "ok"
      ? {
          border: "border-emerald-400/20",
          bg: "bg-emerald-500/7",
          icon: CheckCircle2,
          iconWrap: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
          title: "Readout",
        }
      : severity === "warn"
        ? {
            border: "border-amber-400/22",
            bg: "bg-amber-500/8",
            icon: AlertTriangle,
            iconWrap: "bg-amber-500/15 text-amber-100 ring-amber-400/25",
            title: "Readout",
          }
        : {
            border: "border-rose-400/22",
            bg: "bg-rose-500/8",
            icon: AlertTriangle,
            iconWrap: "bg-rose-500/15 text-rose-100 ring-rose-400/25",
            title: "Readout",
          };
  const Icon = styles.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-sentio-2xl border p-6 shadow-sentio-sm backdrop-blur-xl sm:p-7", styles.border, styles.bg)}
    >
      <div className="flex items-start gap-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1", styles.iconWrap)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-sentio-text-muted">{styles.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-sentio-text-secondary">{text}</p>
        </div>
      </div>
    </motion.div>
  );
}
