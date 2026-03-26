import { motion } from "framer-motion";

export function EmptyIllustration({ className }) {
  return (
    <svg
      viewBox="0 0 200 140"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ei-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(167 139 250)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id="ei-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(167 139 250)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(167 139 250)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="140" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <motion.circle
        cx="100"
        cy="70"
        r="34"
        stroke="url(#ei-line)"
        strokeWidth="1"
        strokeOpacity="0.4"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx="100" cy="70" r="4" fill="url(#ei-glow)" />
      {[
        [100, 36],
        [130, 54],
        [130, 86],
        [100, 104],
        [70, 86],
        [70, 54],
      ].map(([x, y], i) => (
        <motion.circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="3"
          fill="rgba(196, 181, 253, 0.9)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.12 + i * 0.05, type: "spring", stiffness: 320, damping: 22 }}
        />
      ))}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <motion.line
          key={deg}
          x1="100"
          y1="70"
          x2={100 + Math.cos((deg * Math.PI) / 180) * 30}
          y2={70 + Math.sin((deg * Math.PI) / 180) * 30}
          stroke="url(#ei-line)"
          strokeWidth="0.75"
          strokeOpacity="0.35"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 + i * 0.035 }}
        />
      ))}
    </svg>
  );
}
