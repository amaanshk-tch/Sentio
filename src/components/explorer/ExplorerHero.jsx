import { motion } from "framer-motion";
import { ScanInput } from "./ScanInput";

export function ExplorerHero({ query, setQuery, onScan, loading }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="overflow-hidden rounded-sentio-2xl border border-white/[0.08] bg-[var(--surface-elevated)]/90 shadow-sentio-md ring-1 ring-white/[0.05] backdrop-blur-xl">
        <div className="border-b border-white/[0.06] px-5 py-8 sm:px-8 sm:py-9">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-caption text-sentio-text-muted">Work mode</p>
            <h1 className="text-h1 mt-2 text-balance text-sentio-text">Risk scan</h1>
            <p className="mt-3 text-sm leading-relaxed text-sentio-text-secondary sm:text-base">
              Enter a public key or <span className="font-medium text-sentio-text-secondary">CODE:ISSUER</span>. Results
              update below—one composite readout, then detail.
            </p>
          </div>
        </div>
        <div className="px-5 py-7 sm:px-8 sm:py-8">
          <ScanInput query={query} setQuery={setQuery} onScan={onScan} loading={loading} />
          <p className="mt-4 text-center text-xs leading-relaxed text-sentio-text-subtle">
            Public keys start with{" "}
            <kbd className="rounded border border-white/[0.08] bg-sentio-surface/80 px-1.5 py-0.5 font-mono text-[0.7rem]">
              G
            </kbd>
            . Assets use{" "}
            <kbd className="rounded border border-white/[0.08] bg-sentio-surface/80 px-1.5 py-0.5 font-mono text-[0.7rem]">
              CODE:ISSUER
            </kbd>
            .
          </p>
        </div>
      </div>
    </motion.section>
  );
}
