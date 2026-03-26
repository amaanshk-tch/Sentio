import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { cn } from "../../lib/cn";

const actionConfig = {
  safe: {
    icon: ShieldCheck,
    label: "Proceed normally",
    desc: "No major red flags detected. Standard caution applies.",
    cls: "border-emerald-400/20 bg-emerald-500/7 text-emerald-200",
    iconCls: "text-emerald-300",
  },
  warn: {
    icon: ShieldQuestion,
    label: "Verify before interacting",
    desc: "Check the issuer's official site and stellar.toml before trusting.",
    cls: "border-amber-400/22 bg-amber-500/8 text-amber-100",
    iconCls: "text-amber-300",
  },
  bad: {
    icon: ShieldAlert,
    label: "Do NOT interact",
    desc: "Multiple high-risk signals detected. Treat as untrusted.",
    cls: "border-rose-400/22 bg-rose-500/8 text-rose-100",
    iconCls: "text-rose-300",
  },
};

const readoutConfig = {
  ok:   { border: "border-emerald-400/20", bg: "bg-emerald-500/7", icon: CheckCircle2, iconWrap: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25" },
  warn: { border: "border-amber-400/22",   bg: "bg-amber-500/8",   icon: AlertTriangle, iconWrap: "bg-amber-500/15 text-amber-100 ring-amber-400/25" },
  bad:  { border: "border-rose-400/22",    bg: "bg-rose-500/8",    icon: AlertTriangle, iconWrap: "bg-rose-500/15 text-rose-100 ring-rose-400/25" },
};

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const low = confidence < 60;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        low
          ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
          : "border-white/8 bg-white/5 text-sentio-text-muted"
      )}
    >
      <Info className="h-3 w-3 shrink-0" aria-hidden />
      {low
        ? `Low confidence (${confidence}%) — some data unavailable`
        : `${confidence}% confidence`}
    </span>
  );
}

export function InsightPanel({ text, score, action, confidence }) {
  const severity    = score >= 70 ? "ok" : score >= 40 ? "warn" : "bad";
  const actionLevel = score >= 70 ? "safe" : score >= 40 ? "warn" : "bad";
  const styles      = readoutConfig[severity];
  const Icon        = styles.icon;
  const ActCfg      = actionConfig[actionLevel];
  const ActIcon     = ActCfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3"
    >
      <div className={cn("rounded-sentio-2xl border p-6 shadow-sentio-sm backdrop-blur-xl sm:p-7", styles.border, styles.bg)}>
        <div className="flex items-start gap-4">
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1", styles.iconWrap)}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-sentio-text-muted">Readout</p>
            <p className="mt-2 text-sm leading-relaxed text-sentio-text-secondary">{text}</p>

            {confidence != null && (
              <div className="mt-4">
                <ConfidenceBadge confidence={confidence} />
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={actionLevel}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            ActCfg.cls
          )}
        >
          <ActIcon className={cn("mt-0.5 h-4 w-4 shrink-0", ActCfg.iconCls)} aria-hidden />
          <div>
            <p className="text-xs font-semibold tracking-wide">{ActCfg.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-80">
              {action ?? ActCfg.desc}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
