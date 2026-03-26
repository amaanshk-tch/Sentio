import { motion } from "framer-motion";
import { cn } from "../lib/cn";

function toneWidth(tone) {
  if (tone === "emerald") return 92;
  if (tone === "amber") return 64;
  if (tone === "rose") return 38;
  return 55;
}

function toneBarClass(tone) {
  if (tone === "emerald") return "from-emerald-400/90 to-cyan-400/70";
  if (tone === "amber") return "from-amber-400/90 to-orange-400/60";
  if (tone === "rose") return "from-rose-400/90 to-fuchsia-500/60";
  return "from-zinc-400/70 to-zinc-500/50";
}

export function SignalChart({ items, className }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-caption text-sentio-text-muted">Signal strength</p>
      <div className="space-y-3.5">
        {list.map((it, idx) => {
          const w = toneWidth(it.tone);
          return (
            <div key={it.key ?? idx} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-sentio-text-secondary">{it.title}</span>
                <span className="shrink-0 tabular-nums text-sentio-text-muted">{it.status}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/6 ring-1 ring-white/4">
                <motion.div
                  className={cn("h-full rounded-full bg-linear-to-r", toneBarClass(it.tone))}
                  initial={{ width: 0 }}
                  animate={{ width: `${w}%` }}
                  transition={{ duration: 0.55, delay: 0.04 * idx, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
