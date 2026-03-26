import { motion } from "framer-motion";
import { cn } from "../lib/cn";

export function TabList({ className, children }) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex gap-0.5 overflow-visible rounded-xl border border-white/8 bg-sentio-elevated/80 p-1 backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Animated sliding indicator via layoutId — use one TabList per screen or pass unique `groupId` */
export function Tab({ selected, onSelect, children, className, groupId = "sentio-tabs" }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200",
        selected ? "text-sentio-text" : "text-sentio-text-muted hover:text-sentio-text-secondary",
        className
      )}
    >
      {selected ? (
        <motion.span
          layoutId={`${groupId}-indicator`}
          className="absolute inset-0 -z-10 rounded-lg bg-white/9 shadow-sentio-sm ring-1 ring-white/6"
          transition={{ type: "spring", stiffness: 440, damping: 34 }}
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
