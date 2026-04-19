import { motion, type Variants } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { GlowButton } from "./GlowButton";
import { BrandMark } from "./BrandMark";
import { NetworkCard } from "./NetworkCard";

const fade: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.07 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export function LandingHero({ onReveal }: { onReveal?: () => void }) {
  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-4 py-5"
      >
        <BrandMark to="/" size="lg" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-sentio-text-secondary transition-all hover:text-foreground"
          >
            Admin <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-sentio-sm backdrop-blur-md transition-all hover:border-foreground/20 hover:bg-sentio-surface-hover hover:shadow-sentio-md"
          >
            <span className="hidden sm:inline">Open explorer</span>
            <span className="sm:hidden">Explore</span>
            <Compass className="h-4 w-4 opacity-90" aria-hidden />
          </Link>
        </div>
      </motion.header>

      <div className="grid flex-1 grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8 lg:pt-4">
        <div>
          <motion.div custom={0} variants={fade} initial="hidden" animate="show">
            <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
              Stellar risk intelligence
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="text-display mt-6 max-w-[20ch] text-balance"
          >
            Check if it's <strong>safe</strong> before you{" "}
            <span className="bg-linear-to-r from-accent to-primary bg-clip-text font-semibold text-transparent">
              click
            </span>
            .
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="text-body-lg mt-5 max-w-lg"
          >
            You receive a token. Looks legit. It isn't.
            <br />
            <span className="text-sentio-text-muted">
              Sentio intercepts and analyzes the risk before it's too late.
            </span>
          </motion.p>

          <motion.div custom={3} variants={fade} initial="hidden" animate="show" className="mt-9 flex flex-wrap gap-3">
            <GlowButton to="/explorer">
              Open explorer
              <ArrowRight className="h-4 w-4" aria-hidden />
            </GlowButton>
            <button
              onClick={onReveal}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-sentio-text-muted transition hover:text-foreground"
            >
              How it works
              <svg
                className="h-4 w-4 animate-bounce"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </motion.div>

          <motion.ul
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-foreground/6 pt-8 text-xs text-sentio-text-muted"
          >
            <li>Horizon-backed context</li>
          </motion.ul>
        </div>

        <motion.div
          className="relative flex flex-col items-center justify-center lg:items-end lg:translate-x-10 translate-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="w-full max-w-[420px]">
            <NetworkCard />
          </div>
        </motion.div>
      </div>
    </>
  );
}
