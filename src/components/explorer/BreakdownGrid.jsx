import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { staggerContainer, staggerItem } from "../../styles/motion";
import { cn } from "../../lib/cn";
import { toneCardShell, toneIconWrap } from "./utils";

const FLAG_LABELS = {
  bot_spam: "Bot / Spam",
  burst: "Burst Activity",
  dusting: "Dusting",
  lookalike: "Lookalike Asset",
  no_domain: "No Domain",
  high_supply: "High Supply",
  clawback: "Clawback",
  flagged: "Flagged",
};

export function BreakdownGrid({ items }) {
  return (
    <motion.div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {items.map((it) => (
        <motion.div key={it.key} variants={staggerItem}>
          <InfoCard {...it} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function InfoCard({ icon: Icon, title, value, status, tone, flag }) {
  const shell = toneCardShell(tone);
  const iconWrap = toneIconWrap(tone);
  const hasFlag = Boolean(flag);

  const badge =
    tone === "emerald"
      ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/25 bg-amber-500/12 text-amber-100"
        : tone === "rose"
          ? "border-rose-400/25 bg-rose-500/12 text-rose-100"
          : "border-white/8 bg-white/4 text-sentio-text-secondary";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={cn(
        "relative rounded-sentio-xl border p-5 shadow-sentio-sm backdrop-blur-md",
        "ring-1 ring-inset ring-white/3",
        shell
      )}
    >
      {hasFlag && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/12 px-2 py-0.5 text-[0.6rem] font-semibold text-rose-300">
          <Flag className="h-2.5 w-2.5" aria-hidden />
          {FLAG_LABELS[flag] ?? flag}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1", iconWrap)}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-sentio-text-muted">{title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-sentio-text">{value}</p>
          </div>
        </div>
        <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold", badge)}>
          {status}
        </span>
      </div>
    </motion.div>
  );
}
