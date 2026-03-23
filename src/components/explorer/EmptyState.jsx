import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyIllustration } from "../../ui/EmptyIllustration";
import { EXAMPLES } from "./constants";

export function EmptyState({ onFillExample }) {
  return (
    <Card interactive className="border-dashed border-white/[0.12] bg-sentio-surface/35">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[220px]"
        >
          <EmptyIllustration className="h-auto w-full" />
        </motion.div>
        <h2 className="text-h3 mt-6 text-sentio-text">Ready to scan</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-sentio-text-secondary">
          Paste a Stellar address or asset above, then press <span className="font-medium text-sentio-text">Scan</span>.
          You’ll get a composite score, a short readout, and per-metric detail below.
        </p>

        <div className="mt-8 w-full max-w-lg space-y-3 text-left">
          <p className="text-caption text-center text-sentio-text-muted">Try an example</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => onFillExample(EXAMPLES.account)}
              className={cn(
                "rounded-xl border border-white/[0.1] bg-sentio-elevated/80 px-4 py-3 text-left text-sm transition",
                "hover:border-violet-400/30 hover:bg-sentio-surface/80",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
              )}
            >
              <span className="text-xs font-medium text-sentio-text-muted">Account</span>
              <span className="mt-1 block font-mono text-xs text-sentio-text-secondary">
                {EXAMPLES.account.slice(0, 8)}…{EXAMPLES.account.slice(-6)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onFillExample(EXAMPLES.asset)}
              className={cn(
                "rounded-xl border border-white/[0.1] bg-sentio-elevated/80 px-4 py-3 text-left text-sm transition",
                "hover:border-violet-400/30 hover:bg-sentio-surface/80",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70"
              )}
            >
              <span className="text-xs font-medium text-sentio-text-muted">Asset</span>
              <span className="mt-1 block font-mono text-xs text-sentio-text-secondary">
                USDC:GA5Z…KZVN
              </span>
            </button>
          </div>
        </div>

        <ul className="mt-8 w-full max-w-lg space-y-3 text-left text-sm text-sentio-text-secondary">
          <li className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/90" aria-hidden />
            <span>
              <span className="font-medium text-sentio-text">Use case:</span> treasury, compliance, and issuer due
              diligence on Stellar.
            </span>
          </li>
          <li className="flex gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
            <span>
              <span className="font-medium text-sentio-text">Accuracy:</span> paste the full key—partial strings may
              fail validation.
            </span>
          </li>
        </ul>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="primary" className="rounded-xl px-5" onClick={() => onFillExample(EXAMPLES.account)}>
            Fill example account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Link
            to="/"
            className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-sentio-text-muted underline-offset-4 transition hover:text-sentio-text-secondary hover:underline"
          >
            ← Product overview
          </Link>
        </div>
      </div>
    </Card>
  );
}
