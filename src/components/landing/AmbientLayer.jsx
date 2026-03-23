import { motion } from "framer-motion";
import Aurora from "../../ui/Aurora";

/** Calm base: one aurora, soft vignette, grid — minimal drifting light */
export function AmbientLayer({ reduced }) {
  return (
    <>
      <div className="pointer-events-none fixed inset-0">
        <Aurora colorStops={["#4c1d95", "#6d28d9", "#0e7490"]} blend={0.38} amplitude={0.65} speed={0.45} />
      </div>
      <div
        className="pointer-events-none fixed inset-0 opacity-75"
        style={{
          background:
            "radial-gradient(900px 560px at 10% 0%, rgba(91,33,182,0.22), transparent 55%), radial-gradient(700px 480px at 92% 10%, rgba(34,211,238,0.08), transparent 52%)",
        }}
      />
      <div className="sentio-grid-bg pointer-events-none fixed inset-0 opacity-22" />
      <motion.div
        className="pointer-events-none absolute -right-24 top-1/4 h-[min(420px,50vh)] w-[min(420px,50vw)] max-w-none rounded-full bg-violet-600/12 blur-[100px]"
        animate={reduced ? undefined : { opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
