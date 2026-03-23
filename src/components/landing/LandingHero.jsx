import { motion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { BrandMark } from "../../ui/BrandMark";
import { ButtonLink } from "../../ui/Button";
import { HeroGraphic } from "./HeroGraphic";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.07 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function LandingHero() {
  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-4 py-5"
      >
        <BrandMark to="/" size="md" />
        <ButtonLink to="/explorer" variant="secondary" className="px-4 py-2.5 sm:px-5">
          <span className="hidden sm:inline">Open explorer</span>
          <span className="sm:hidden">Explore</span>
          <Compass className="h-4 w-4 opacity-90" aria-hidden />
        </ButtonLink>
      </motion.header>

      <div className="grid flex-1 grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-14 lg:pt-4">
        <div>
          <motion.div custom={0} variants={fade} initial="hidden" animate="show">
            <span className="inline-flex rounded-full border border-white/8 bg-sentio-surface/50 px-3 py-1.5 text-caption text-sentio-text-secondary">
              Stellar risk intelligence
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="text-display mt-6 max-w-[20ch] text-balance text-sentio-text"
          >
            Risk clarity for{" "}
            <span className="bg-linear-to-r from-violet-200 to-cyan-200/90 bg-clip-text text-transparent">
              Stellar infrastructure
            </span>
          </motion.h1>

          <motion.p custom={2} variants={fade} initial="hidden" animate="show" className="mt-5 max-w-lg text-body-lg">
            Sentio aggregates on-chain signals into a single score and a calm readout—built for teams that need
            confidence, not noise.
          </motion.p>

          <motion.div custom={3} variants={fade} initial="hidden" animate="show" className="mt-9 flex flex-wrap gap-3">
            <ButtonLink to="/explorer" variant="primary" className="rounded-xl px-6 py-3">
              Open explorer
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <a
              href="#what"
              className="inline-flex items-center rounded-xl px-4 py-3 text-sm font-medium text-sentio-text-muted transition hover:text-sentio-text-secondary"
            >
              How it works
            </a>
          </motion.div>

          <motion.ul
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/6 pt-8 text-xs text-sentio-text-muted"
          >
            <li>Horizon-backed context</li>
            <li>Composable 0–100 score</li>
            <li>Built for operations</li>
          </motion.ul>
        </div>

        <HeroGraphic />
      </div>
    </>
  );
}
