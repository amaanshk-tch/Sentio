import { motion } from "framer-motion";
import { FlowingPaths } from "./FlowingPaths";

export function AmbientLayer() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(900px 560px at 10% 0%, hsl(210 30% 12% / 0.5), transparent 55%), radial-gradient(700px 480px at 92% 10%, hsl(185 100% 50% / 0.04), transparent 52%)",
        }}
      />

      <FlowingPaths />

      <div className="sentio-grid-bg pointer-events-none fixed inset-0 opacity-[0.18]" />

      <motion.div
        className="pointer-events-none absolute -right-24 top-1/4 h-[min(420px,50vh)] w-[min(420px,50vw)] max-w-none rounded-full blur-[100px]"
        style={{ background: "hsl(210 20% 15% / 0.08)" }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="pointer-events-none absolute -left-32 bottom-1/4 h-[300px] w-[300px] rounded-full blur-[120px]"
        style={{ background: "hsl(185 100% 50% / 0.05)" }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
      />
    </>
  );
}
