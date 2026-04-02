import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

/* ─── Animated count-up hook ──────────────────────────────── */
function useCountUp(target: number | null, duration = 1300, delay = 350) {
  const [val, setVal] = useState<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === null) {
      setVal(null);
      return;
    }
    const from = prevRef.current;
    prevRef.current = target;

    const timeout = setTimeout(() => {
      const start = performance.now();
      let raf: number;
      function tick(now: number) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(from + (target - from) * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, delay);

    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return val;
}

function fmtLarge(n: number | null) {
  if (n === null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
}

/* ─── Static demo data (no external API needed) ──────────── */
const DEMO_METRICS = {
  accounts: 8_200_000,
  assets: 94_300,
  ops24h: 12_700_000,
};

function MetricTile({ label, value }: { label: string; value: number }) {
  const animated = useCountUp(value);
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-foreground/5 bg-background/40 p-3.5 backdrop-blur-sm">
      <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
        {animated !== null ? fmtLarge(animated) : <span className="sentio-shimmer inline-block h-5 w-16 rounded" />}
      </span>
    </div>
  );
}

/* ─── Network node SVG background ────────────────────────── */
function NetworkNodes() {
  const nodes = [
    { x: 50, y: 50, r: 3, hub: true },
    { x: 16, y: 20, r: 1.8 },
    { x: 82, y: 14, r: 1.6 },
    { x: 90, y: 55, r: 2.0 },
    { x: 70, y: 86, r: 1.5 },
    { x: 28, y: 82, r: 1.8 },
    { x: 8, y: 54, r: 1.4 },
    { x: 52, y: 8, r: 1.5 },
    { x: 38, y: 36, r: 1.2 },
    { x: 66, y: 32, r: 1.3 },
  ];

  const edges: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [0, 8], [0, 9], [1, 6], [1, 7], [2, 7],
    [2, 9], [3, 9], [4, 5], [5, 6], [8, 1],
  ];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(263,70%,58%)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="hsl(263,70%,58%)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="edge-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(263,70%,65%)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(185,100%,50%)" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="url(#edge-g)"
          strokeWidth="0.3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 + i * 0.03, duration: 0.55 }}
        />
      ))}

      {nodes.filter(n => !n.hub).map((n, i) => (
        <motion.circle
          key={i}
          cx={n.x} cy={n.y} r={n.r}
          fill="hsl(263,70%,60%)"
          fillOpacity={0.5}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0.4, 0.8, 0.4], scale: 1 }}
          transition={{
            opacity: { duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
            scale: { delay: 0.35 + i * 0.045, type: "spring", stiffness: 240, damping: 20 },
          }}
        />
      ))}

      <motion.circle
        cx="50" cy="50" r="8"
        fill="url(#hub-glow)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      />
      <motion.circle
        cx="50" cy="50" r="2.8"
        fill="hsl(263,70%,58%)"
        stroke="hsl(263,70%,80%)"
        strokeWidth="0.6"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

/* ─── Main NetworkCard ───────────────────────────────────── */
export function NetworkCard() {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-foreground/8 bg-sentio-elevated/80 shadow-sentio-glow backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Background SVG network */}
      <div className="absolute inset-0 opacity-40">
        <NetworkNodes />
      </div>

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
                <path
                  d="M8 1.5l1.6 4.6H14l-3.8 2.8 1.5 4.6L8 10.8l-3.7 2.7 1.5-4.6L2 6.1h4.4z"
                  fill="none"
                  stroke="hsl(263,70%,75%)"
                  strokeWidth="1.15"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[0.6rem] font-semibold tracking-widest text-sentio-text-muted">
              STELLAR NETWORK
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentio-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sentio-success" />
            </span>
            <span className="text-[0.6rem] font-medium text-sentio-success">LIVE</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <MetricTile label="Accounts" value={DEMO_METRICS.accounts} />
          <MetricTile label="Assets" value={DEMO_METRICS.assets} />
          <MetricTile label="24h Ops" value={DEMO_METRICS.ops24h} />
        </div>

        {/* Health status */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-sentio-success/15 bg-sentio-success/5 px-4 py-2.5">
          <span className="text-xs font-medium text-sentio-success">Network Healthy</span>
          <span className="text-[0.6rem] text-sentio-text-muted">Avg close: 5.2s</span>
        </div>
      </div>
    </motion.div>
  );
}
