import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { staggerContainer, staggerItem } from "../../styles/motion";
import { cn } from "../../lib/cn";
import { ButtonLink } from "../../ui/Button";

const sections = [
  {
    id: "what",
    eyebrow: "What Sentio does",
    title: "One pass across account or asset",
    body:
      "Point Sentio at a Stellar public key or an issued asset. It returns a composite risk score, prioritized reasons, and structured metrics you can share with a team—without jumping between tools.",
  },
  {
    id: "signals",
    eyebrow: "What it checks",
    title: "Signals that matter for trust",
    body:
      "Age and activity, trustlines, issuer flags, domain verification where available, and supply context for assets. Cyan highlights live data; semantic colors reflect outcome—not decoration.",
  },
  {
    id: "why",
    eyebrow: "Why that matters",
    title: "Decisions need a steady readout",
    body:
      "Treasury and compliance workflows need fast, consistent interpretation. Sentio stays quiet until you run a scan—then it surfaces a clear story you can act on next to your own policies.",
  },
];

export function LandingSections({ reduced }) {
  return (
    <div className="mt-section space-y-section">
      {sections.map((s, idx) => (
        <motion.section
          key={s.id}
          id={s.id}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
          className="scroll-mt-28 rounded-sentio-2xl border border-white/6 bg-sentio-surface/35 px-6 py-10 ring-1 ring-white/3 backdrop-blur-md sm:px-10 sm:py-12"
        >
          <p className="text-caption text-sentio-text-muted">{s.eyebrow}</p>
          <h2 className="text-h1 mt-3 max-w-2xl text-balance text-sentio-text">{s.title}</h2>
          <p className="mt-4 max-w-2xl text-body-lg">{s.body}</p>
        </motion.section>
      ))}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {["Focused UI", "Operational tempo", "Stellar-native"].map((label) => (
          <motion.div
            key={label}
            variants={staggerItem}
            whileHover={reduced ? undefined : { y: -3 }}
            className={cn(
              "rounded-xl border border-white/6 bg-white/3 px-5 py-4 text-sm font-medium text-sentio-text-secondary",
              "ring-1 ring-white/3 transition-shadow hover:shadow-sentio-sm"
            )}
          >
            {label}
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center gap-4 rounded-sentio-2xl border border-violet-500/20 bg-(--surface-elevated)/80 px-8 py-12 text-center ring-1 ring-violet-500/10 backdrop-blur-md sm:px-12"
      >
        <p className="text-caption text-sentio-text-muted">Next step</p>
        <p className="max-w-md text-lg font-medium text-sentio-text">Run a scan in the explorer</p>
        <ButtonLink to="/explorer" variant="primary" className="rounded-xl px-8 py-3">
          Open explorer
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </motion.div>
    </div>
  );
}
