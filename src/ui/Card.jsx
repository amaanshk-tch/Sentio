import { motion } from "framer-motion";
import { cn } from "../lib/cn";

const tier = {
  base: "border-sentio-border bg-[var(--surface-base)] shadow-sentio-md",
  elevated:
    "border-sentio-border bg-[var(--surface-elevated)] shadow-sentio-md shadow-[var(--shadow-sentio-glow)]",
  highlight:
    "border-violet-500/20 bg-[var(--surface-highlight)] shadow-sentio-md ring-1 ring-violet-500/15 ring-inset ring-white/[0.03]",
  interactive:
    "border-sentio-border bg-[var(--surface-base)] shadow-sentio-md transition-shadow duration-200 hover:shadow-[0_8px_40px_-8px_rgba(124,58,237,0.2)]",
};

const shell =
  "rounded-sentio-2xl backdrop-blur-xl ring-1 ring-white/[0.04] [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.04)]";

export function Card({
  as: Tag = "div",
  className,
  padding = "p-6 sm:p-8",
  children,
  elevated,
  interactive,
  surface,
}) {
  const resolved =
    surface ?? (interactive ? "interactive" : elevated ? "elevated" : "base");
  const cls = cn(shell, tier[resolved] ?? tier.base, padding, className);

  if (resolved === "interactive") {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={cls}
      >
        {children}
      </motion.div>
    );
  }

  return <Tag className={cls}>{children}</Tag>;
}

export function CardHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="text-caption">{eyebrow}</p> : null}
        {title ? <h2 className="text-h2 text-sentio-text">{title}</h2> : null}
        {description ? <p className="max-w-xl text-sm leading-relaxed text-sentio-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
