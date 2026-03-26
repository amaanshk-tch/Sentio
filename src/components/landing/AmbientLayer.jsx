import { motion } from "framer-motion";

/** Calm base: soft vignette, grid — flowing data signal waves */
export function AmbientLayer({ reduced }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(900px 560px at 10% 0%, rgba(91,33,182,0.22), transparent 55%), radial-gradient(700px 480px at 92% 10%, rgba(0,240,255,0.08), transparent 52%)",
        }}
      />
      
      {/* Signal Waves */}
      <svg className="pointer-events-none fixed inset-0 h-full w-full opacity-30 mix-blend-screen" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="wave-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(0, 240, 255, 0.6)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="wave-purple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(124, 58, 237, 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        
        <motion.path
          d="M-50,60 Q-25,55 0,60 T50,60 T100,60 T150,60"
          fill="none"
          stroke="url(#wave-purple)"
          strokeWidth="0.15"
          animate={reduced ? undefined : { x: [0, 50] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M-50,40 Q-25,30 0,40 T50,40 T100,40 T150,40"
          fill="none"
          stroke="url(#wave-cyan)"
          strokeWidth="0.1"
          animate={reduced ? undefined : { x: [0, 50] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M-50,75 Q-25,85 0,75 T50,75 T100,75 T150,75"
          fill="none"
          stroke="rgba(0, 240, 255, 0.15)"
          strokeWidth="0.05"
          animate={reduced ? undefined : { x: [0, 50] }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      <div className="sentio-grid-bg pointer-events-none fixed inset-0 opacity-22" />
      <motion.div
        className="pointer-events-none absolute -right-24 top-1/4 h-[min(420px,50vh)] w-[min(420px,50vw)] max-w-none rounded-full bg-violet-600/12 blur-[100px]"
        animate={reduced ? undefined : { opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}
