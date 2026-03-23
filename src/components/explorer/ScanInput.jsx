import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/Button";

export function ScanInput({ query, setQuery, onScan, loading }) {
  const canScan = query.trim().length > 0 && !loading;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch">
      <label className="relative flex-1">
        <span className="sr-only">Stellar address or asset</span>
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sentio-text-subtle">
          <Shield className="h-4 w-4" aria-hidden />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onScan();
          }}
          placeholder="Paste Stellar address or CODE:ISSUER"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "h-14 w-full rounded-xl border border-white/[0.1] bg-sentio-elevated/95 pl-12 pr-4 text-sm text-sentio-text shadow-sentio-sm placeholder:text-sentio-text-subtle",
            "outline-none ring-0 transition",
            "focus:border-violet-400/40 focus:bg-sentio-surface focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18)]"
          )}
        />
      </label>

      <Button
        type="button"
        onClick={onScan}
        disabled={!canScan}
        variant="primary"
        className="h-14 shrink-0 rounded-xl px-6 sm:min-w-[132px]"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <motion.span
              className="inline-block h-4 w-4 rounded-full border-2 border-white/25 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
            Scanning
          </span>
        ) : (
          <>
            Scan
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </Button>
    </div>
  );
}
