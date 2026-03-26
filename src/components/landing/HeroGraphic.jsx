/**
 * HeroGraphic — Live Stellar Network Snapshot
 *
 * Displays real Stellar ecosystem metrics fetched from Horizon + StellarExpert.
 * Designed as a premium landing-page visual, distinct from the explorer's
 * asset/account scan UI.
 *
 * Component tree:
 *   HeroGraphic
 *   ├── BackgroundNetworkVisual   (ambient SVG node/edge grid)
 *   └── NetworkSnapshotCard
 *       ├── NetworkStatusBadge
 *       ├── HeadingBlock
 *       ├── MetricsGrid
 *       │   ├── MetricTile × 3   (Accounts, Assets, 24h Ops)
 *       │   └── NetworkHealthTile
 *       └── CardFooter
 */

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";
import { useStellarNetwork } from "../../hooks/useStellarNetwork";

/* ─── Motion presets ─────────────────────────────────────────────────────── */
const ease = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.38, ease },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.38 } },
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */
function fmtLarge(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
}

/* ─── useCountUp ─────────────────────────────────────────────────────────── */
/**
 * Animates smoothly from the previous value to the new target.
 * Returns null while the target is null (shows loading state).
 * Respects prefers-reduced-motion.
 */
function useCountUp(target, { duration = 1300, delay = 350 } = {}) {
  const [val, setVal] = useState(null);
  const reduced       = useReducedMotion();
  const prevRef       = useRef(null);
  const rafRef        = useRef(null);

  useEffect(() => {
    if (target === null) { setVal(null); return; }
    if (reduced) { setVal(target); prevRef.current = target; return; }

    const from = prevRef.current ?? 0;
    prevRef.current = target;

    const t = setTimeout(() => {
      const start = performance.now();
      function tick(now) {
        const p     = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(from + (target - from) * eased));
        if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
      }
      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay, reduced]);

  return val;
}

/* ─── useRelativeTime ────────────────────────────────────────────────────── */
function useRelativeTime(timestamp) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      if (!timestamp) { setLabel(""); return; }
      const s = Math.round((Date.now() - timestamp) / 1000);
      setLabel(s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [timestamp]);
  return label;
}

/* ─── Health config ──────────────────────────────────────────────────────── */
const healthConfig = {
  healthy:  { dot: "bg-sentio-success", text: "text-sentio-success",  ring: "ring-sentio-success/25",  bg: "bg-sentio-success/8"  },
  stable:   { dot: "bg-sentio-warning", text: "text-sentio-warning",  ring: "ring-sentio-warning/25",  bg: "bg-sentio-warning/8"  },
  degraded: { dot: "bg-sentio-danger",  text: "text-sentio-danger",   ring: "ring-sentio-danger/25",   bg: "bg-sentio-danger/8"   },
  unknown:  { dot: "bg-sentio-text-subtle", text: "text-sentio-text-muted", ring: "ring-white/10", bg: "bg-white/5" },
};

/* ─── BackgroundNetworkVisual ────────────────────────────────────────────── */
const NET_NODES = [
  { id: "c",  x: 50, y: 50, r: 2.8, hub: true  },
  { id: "a",  x: 16, y: 20, r: 1.8 },
  { id: "b",  x: 82, y: 14, r: 1.6 },
  { id: "d",  x: 90, y: 55, r: 2.0 },
  { id: "e",  x: 70, y: 86, r: 1.5 },
  { id: "f",  x: 28, y: 82, r: 1.8 },
  { id: "g",  x: 8,  y: 54, r: 1.4 },
  { id: "h",  x: 52, y: 8,  r: 1.5 },
  { id: "i",  x: 38, y: 36, r: 1.2 },
  { id: "j",  x: 66, y: 32, r: 1.3 },
];

const NET_EDGES = [
  ["c","a"],["c","b"],["c","d"],["c","e"],["c","f"],
  ["c","i"],["c","j"],["a","g"],["a","h"],["b","h"],
  ["b","j"],["d","j"],["e","f"],["f","g"],["i","a"],
];

function getNode(id) { return NET_NODES.find(n => n.id === id); }

function BackgroundNetworkVisual({ reduced }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="bg-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgb(124 58 237)"  stopOpacity="0.7" />
          <stop offset="100%" stopColor="rgb(124 58 237)"  stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bg-node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgb(139 92 246)"  stopOpacity="0.6" />
          <stop offset="100%" stopColor="rgb(139 92 246)"  stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bg-edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="rgb(139 92 246)"  stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(34 211 238)"  stopOpacity="0.08" />
        </linearGradient>
        <filter id="bg-blur">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Edges */}
      {NET_EDGES.map(([a, b], i) => {
        const na = getNode(a); const nb = getNode(b);
        return (
          <motion.line
            key={`${a}-${b}`}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="url(#bg-edge-grad)"
            strokeWidth="0.3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.03, duration: 0.55, ease }}
          />
        );
      })}

      {/* Satellite nodes */}
      {NET_NODES.filter(n => !n.hub).map((n, i) => (
        <motion.g
          key={n.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 + i * 0.045, type: "spring", stiffness: 240, damping: 20 }}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <circle cx={n.x} cy={n.y} r={n.r * 2.4} fill="url(#bg-node-glow)" filter="url(#bg-blur)" />
          <motion.circle
            cx={n.x} cy={n.y} r={n.r}
            fill="rgba(139,92,246,0.5)"
            animate={reduced ? undefined : { opacity: [0.45, 0.8, 0.45] }}
            transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <circle cx={n.x} cy={n.y} r={n.r * 0.42} fill="rgba(196,181,253,0.85)" />
        </motion.g>
      ))}

      {/* Hub node */}
      <motion.g
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 18 }}
        style={{ transformOrigin: "50px 50px" }}
      >
        <circle cx="50" cy="50" r="8" fill="url(#bg-hub-glow)" filter="url(#bg-blur)" />
        <motion.circle
          cx="50" cy="50" r="2.8"
          fill="rgba(124,58,237,0.85)"
          stroke="rgba(196,181,253,0.5)"
          strokeWidth="0.6"
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle cx="50" cy="50" r="1.1" fill="rgba(221,214,254,0.9)" />
      </motion.g>
    </svg>
  );
}

/* ─── NetworkStatusBadge ─────────────────────────────────────────────────── */
function NetworkStatusBadge({ live, reduced }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Stellar mark + label */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-500/30">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
            <path
              d="M8 1.5l1.6 4.6H14l-3.8 2.8 1.5 4.6L8 10.8l-3.7 2.7 1.5-4.6L2 6.1h4.4z"
              fill="none"
              stroke="rgb(167,139,250)"
              strokeWidth="1.15"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-[0.6rem] font-semibold tracking-widest text-sentio-text-muted">
          STELLAR NETWORK
        </span>
      </div>

      {/* Right: Live dot */}
      {live && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-sentio-success/50"
              animate={reduced ? undefined : { scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sentio-success" />
          </span>
          <span className="text-[0.58rem] font-medium text-sentio-success">LIVE</span>
        </div>
      )}
    </div>
  );
}

/* ─── MetricTile ─────────────────────────────────────────────────────────── */
function MetricTile({ label, rawValue, sublabel, loading, unit, className }) {
  const displayed = useCountUp(rawValue, { duration: 1300, delay: 300 });
  // If unit is provided (e.g. "%"), show raw decimal value + unit; else compress to M/k
  const formatted = displayed === null
    ? null
    : unit
      ? `${displayed}${unit}`
      : fmtLarge(displayed);
  const isLoading  = loading || rawValue === null;

  return (
    <motion.div
      variants={fadeUp}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <p className="text-xs font-medium text-sentio-text-secondary">
        {label}
      </p>
      {isLoading ? (
        <div className="h-7 w-20 animate-pulse rounded-md bg-white/6" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.p
            key={formatted}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease }}
            className="text-[1.35rem] font-bold leading-none tracking-tight text-sentio-text tabular-nums"
            aria-live="polite"
            aria-label={`${label}: ${formatted}`}
          >
            {formatted ?? "—"}
          </motion.p>
        </AnimatePresence>
      )}
      {sublabel && (
        <p className="text-[0.58rem] text-sentio-text-subtle">{sublabel}</p>
      )}
    </motion.div>
  );
}

/* ─── NetworkHealthTile ──────────────────────────────────────────────────── */
function NetworkHealthTile({ health, avgClose, loading, reduced }) {
  const cfg = healthConfig[health?.level ?? "unknown"];

  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-sentio-text-secondary">
        Network Status
      </p>
      {loading || !health ? (
        <div className="h-7 w-20 animate-pulse rounded-md bg-white/6" />
      ) : (
        <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ring-1", cfg.bg, cfg.ring)}>
          <motion.span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)}
            animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className={cn("text-[0.65rem] font-semibold", cfg.text)} aria-live="polite">
            {health.label}
          </span>
        </div>
      )}
      {avgClose !== null && !loading && (
        <p className="text-[0.58rem] text-sentio-text-subtle">
          ~{avgClose}s ledger close
        </p>
      )}
    </motion.div>
  );
}

/* ─── CardFooter ─────────────────────────────────────────────────────────── */
function CardFooter({ updatedAt, onRefresh, refreshing }) {
  const ago = useRelativeTime(updatedAt);
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Timestamp */}
      <div className="flex items-center gap-1.5 text-[0.58rem] text-sentio-text-subtle">
        <span>Horizon data</span>
        {ago && (
          <>
            <span className="opacity-40">·</span>
            <span>Updated {ago}</span>
          </>
        )}
        <motion.button
          onClick={onRefresh}
          aria-label="Refresh network data"
          className="ml-0.5 rounded p-0.5 text-sentio-text-subtle transition hover:text-sentio-text-muted focus-visible:outline"
          whileTap={{ scale: 0.85 }}
          animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
          transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }}
        >
          <RefreshCw className="h-2.5 w-2.5" aria-hidden />
        </motion.button>
      </div>

      {/* Explorer CTA */}
      <a
        href="/explorer"
        className="group inline-flex items-center gap-1 text-[0.62rem] font-medium text-sentio-text-muted transition hover:text-sentio-text-secondary"
      >
        Inspect in explorer
        <ArrowRight
          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </a>
    </div>
  );
}

/* ─── ErrorState ─────────────────────────────────────────────────────────── */
function ErrorCard({ onRetry }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 px-6 py-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <p className="text-sm text-sentio-text-muted">
        Unable to reach the Stellar network.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-sentio-text-secondary transition hover:bg-white/8"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Retry
      </button>
    </motion.div>
  );
}

/* ─── NetworkSnapshotCard ────────────────────────────────────────────────── */
function NetworkSnapshotCard({ status, data, updatedAt, refresh }) {
  const reduced  = useReducedMotion();
  const isLoad   = status === "loading";
  const isRefr   = status === "refreshing";
  const isError  = status === "error";

  return (
    <motion.div
      className="relative z-10 w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-sentio-elevated/92 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.055)] backdrop-blur-2xl"
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
    >
      {/* Top gradient border */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />

      {isError ? (
        <ErrorCard onRetry={refresh} />
      ) : (
        <>
          {/* ── Header ── */}
          <div className="border-b border-white/7 px-5 py-4">
            <NetworkStatusBadge live={!isLoad} reduced={reduced} />
            <div className="mt-3">
              <h2 className="text-[0.95rem] font-semibold leading-tight tracking-tight text-sentio-text">
                Live Network Snapshot
              </h2>
              <p className="mt-0.5 text-[0.65rem] leading-relaxed text-sentio-text-muted">
                Ecosystem scale, activity, and health — before you explore.
              </p>
            </div>
          </div>

          {/* ── Metrics grid ── */}
          <motion.div
            className="grid grid-cols-2 gap-x-1 gap-y-0 divide-x divide-y divide-white/6 *:px-5 *:py-4"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <MetricTile
              label="Current Ledger"
              rawValue={data?.latestLedger ?? null}
              loading={isLoad}
            />
            <MetricTile
              label="Transaction Success"
              rawValue={data?.successRate ?? null}
              sublabel="last 50 ledgers"
              unit="%"
              loading={isLoad}
            />
            <MetricTile
              label="24H Operations"
              rawValue={data?.ops24h ?? null}
              sublabel="extrapolated from live data"
              loading={isLoad}
            />
            <NetworkHealthTile
              health={data?.networkHealth}
              avgClose={data?.avgLedgerClose}
              loading={isLoad}
              reduced={reduced}
            />
          </motion.div>

          {/* ── Footer ── */}
          <div className="border-t border-white/7 px-5 py-3">
            <CardFooter
              updatedAt={updatedAt}
              onRefresh={refresh}
              refreshing={isRefr}
            />
          </div>

          {/* ── Bottom scan sweep ── */}
          <div className="h-0.5 w-full overflow-hidden bg-white/4">
            <motion.div
              className="h-full w-1/3 bg-linear-to-r from-transparent via-violet-400/60 to-transparent"
              animate={reduced ? undefined : { x: ["-100%", "400%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── HeroGraphic (export) ───────────────────────────────────────────────── */
export function HeroGraphic() {
  const reduced                           = useReducedMotion();
  const { status, data, updatedAt, refresh } = useStellarNetwork();

  return (
    <div
      className="relative mx-auto flex w-full max-w-[min(100%,400px)] items-center justify-center sm:max-w-md"
    >
      {/* Ambient background network */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl opacity-50">
        <BackgroundNetworkVisual reduced={reduced} />
      </div>

      {/* Ambient glow halo */}
      <motion.div
        className="pointer-events-none absolute inset-[-2px] rounded-3xl"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(124,58,237,0.16), transparent 65%)",
        }}
        animate={reduced ? undefined : { opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* The card */}
      <NetworkSnapshotCard
        status={status}
        data={data}
        updatedAt={updatedAt}
        refresh={refresh}
      />
    </div>
  );
}
