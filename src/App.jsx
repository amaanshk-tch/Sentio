import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Blocks,
  CircleDot,
  Clock,
  Github,
  Globe,
  Layers,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function truncateMiddle(str, start = 10, end = 10) {
  if (!str) return "";
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

function scoreLabel(score) {
  if (score > 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

function scoreColor(score) {
  if (score > 70) return "emerald";
  if (score >= 40) return "amber";
  return "rose";
}

function colorClasses(color) {
  switch (color) {
    case "emerald":
      return {
        ring: "from-emerald-400 to-cyan-400",
        text: "text-emerald-300",
        badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
        glow: "shadow-[0_0_40px_rgba(52,211,153,0.22)]",
      };
    case "amber":
      return {
        ring: "from-amber-400 to-fuchsia-400",
        text: "text-amber-200",
        badge: "bg-amber-500/15 text-amber-200 border-amber-400/20",
        glow: "shadow-[0_0_40px_rgba(251,191,36,0.16)]",
      };
    default:
      return {
        ring: "from-rose-500 to-fuchsia-500",
        text: "text-rose-200",
        badge: "bg-rose-500/15 text-rose-200 border-rose-400/20",
        glow: "shadow-[0_0_40px_rgba(244,63,94,0.18)]",
      };
  }
}

function glassCardClassName(extra) {
  return cn(
    "rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10",
    "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
    extra
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const onScan = async () => {
    const input = query.trim();
    if (!input) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: input }),
        signal: controller.signal,
      }).finally(() => clearTimeout(t));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Scan failed");
      setResult(data);
    } catch (e) {
      setError(e?.name === "AbortError" ? "Request timed out. Please try again." : e?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0B0B0F] to-[#111827] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(900px 600px at 20% 10%, rgba(168,85,247,0.26), transparent 55%), radial-gradient(800px 520px at 80% 20%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(700px 520px at 50% 90%, rgba(236,72,153,0.16), transparent 55%)",
        }}
      />

      <Navbar />

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6">
        <Hero onScan={onScan} query={query} setQuery={setQuery} loading={loading} />

        <section className="mt-10">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.35 }}
                className={glassCardClassName("p-6 sm:p-8")}
              >
                <LoadingState />
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  "rounded-2xl border border-rose-400/20 bg-rose-500/10 backdrop-blur-lg",
                  "p-6 shadow-[0_0_50px_rgba(244,63,94,0.10)]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 ring-1 ring-rose-300/20">
                    <AlertTriangle className="h-5 w-5 text-rose-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">Scan failed</div>
                    <p className="mt-2 text-sm text-white/70">{error}</p>
                    <div className="mt-4 text-xs text-white/55">
                      Input must be a Stellar account (starts with <span className="text-white/80">G</span>) or{" "}
                      <span className="text-white/80">CODE:ISSUER</span>.
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                  <div className={glassCardClassName("p-6 sm:p-7")}>
                    <RiskGauge score={result.score} />
                  </div>
                  <SummaryCard result={result} />
                </div>

                <BreakdownGrid items={withIcons(result.breakdown)} />

                <WarningPanel text={result.insight} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

function Navbar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            "mt-4 flex items-center justify-between",
            "rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl",
            "px-4 py-3 sm:px-5",
            "shadow-[0_0_40px_rgba(139,92,246,0.15)]"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-white/10">
              <Sparkles className="h-5 w-5 text-violet-200" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              <span className="bg-linear-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                Sentio
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <NavLink href="#" label="Docs" icon={CircleDot} />
            <NavLink href="#" label="GitHub" icon={Github} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, label, icon: Icon }) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        "text-white/80 hover:text-white",
        "hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
      )}
    >
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}

function Hero({ onScan, query, setQuery, loading }) {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
          <Zap className="h-3.5 w-3.5 text-cyan-200" />
          Real-time risk scoring (mock)
        </div>

        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Scan Stellar Accounts &amp; Assets
        </h1>
        <p className="mt-3 text-balance text-base text-white/70 sm:text-lg">
          Get a real-time risk score and security insights
        </p>

        <div className="mt-7">
          <ScanInput query={query} setQuery={setQuery} onScan={onScan} loading={loading} />
          <p className="mt-3 text-xs text-white/45">
            Try: <span className="text-white/70">GA7Q... or USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN</span>
          </p>
        </div>
      </motion.div>
    </section>
  );
}

function ScanInput({ query, setQuery, onScan, loading }) {
  const canScan = query.trim().length > 0 && !loading;
  return (
    <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/35">
          <Shield className="h-4 w-4" />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onScan();
          }}
          placeholder="Paste Stellar address or CODE:ISSUER"
          className={cn(
            "h-12 w-full rounded-xl pl-11 pr-4 text-sm",
            "bg-white/5 text-white placeholder:text-white/35",
            "border border-white/10 backdrop-blur-lg",
            "outline-none transition",
            "focus:border-violet-400/50 focus:shadow-[0_0_40px_rgba(139,92,246,0.30)]"
          )}
        />
      </div>

      <motion.button
        type="button"
        onClick={onScan}
        disabled={!canScan}
        whileHover={canScan ? { scale: 1.02 } : undefined}
        whileTap={canScan ? { scale: 0.99 } : undefined}
        className={cn(
          "h-12 rounded-xl px-5 text-sm font-medium",
          "inline-flex items-center justify-center gap-2",
          "bg-linear-to-r from-violet-500 to-fuchsia-500",
          "shadow-[0_0_40px_rgba(139,92,246,0.30)]",
          "transition",
          "hover:shadow-[0_0_55px_rgba(236,72,153,0.28)]",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {loading ? "Scanning..." : "Scan"}
        <ArrowRight className="h-4 w-4" />
      </motion.button>
    </div>
  );
}

function RiskGauge({ score }) {
  const radius = 86;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;

  const tone = scoreColor(score);
  const classes = colorClasses(tone);

  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current ?? 0;
    prev.current = score;
    const controls = animate(from, score, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [score]);

  const progress = display / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative grid place-items-center", classes.glow)} style={{ width: 220, height: 220 }}>
        <div className="absolute inset-0 rounded-full bg-linear-to-br from-white/6 to-white/0 blur-sm" />
        <svg width="220" height="220" className="relative">
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(168 85 247)" />
              <stop offset="55%" stopColor="rgb(236 72 153)" />
              <stop offset="100%" stopColor="rgb(34 211 238)" />
            </linearGradient>
          </defs>
          <circle
            cx="110"
            cy="110"
            r={normalizedRadius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="transparent"
          />
          <motion.circle
            cx="110"
            cy="110"
            r={normalizedRadius}
            stroke="url(#ringGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ rotate: -90, transformOrigin: "110px 110px" }}
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div className="text-5xl font-semibold tracking-tight">{display}</div>
          <div className="mt-1 text-sm text-white/60">Risk Score</div>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div className={cn("text-sm font-medium", classes.text)}>{scoreLabel(score)}</div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <BadgeCheck className="h-3.5 w-3.5 text-cyan-200" />
          0–100 composite score
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ result }) {
  const tone = scoreColor(result.score);
  const classes = colorClasses(tone);
  return (
    <div className={glassCardClassName("p-6 sm:p-7")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/45">Scanned</div>
          <div className="mt-1 text-base font-medium text-white/90">{truncateMiddle(result.address, 12, 10)}</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              <CircleDot className="h-3.5 w-3.5 text-cyan-200" />
              {result.isAsset ? "Asset" : "Account"}
            </span>
          </div>
        </div>

        <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs", classes.badge)}>
          {result.risk}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-medium text-white/85">Top reasons</div>
        <ul className="mt-3 space-y-2 text-sm text-white/70">
          {result.reasons.slice(0, 3).map((r) => (
            <li key={r} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-linear-to-r from-violet-400 to-cyan-300" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Pill icon={AlertTriangle} label="Heuristics" />
        <Pill icon={Shield} label="Policy checks" />
        <Pill icon={Globe} label="Domain signals" />
      </div>
    </div>
  );
}

function Pill({ icon: Icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
      <Icon className="h-3.5 w-3.5 text-white/60" />
      {label}
    </div>
  );
}

function BreakdownGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((it, idx) => (
        <motion.div
          key={it.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 * idx, duration: 0.35 }}
        >
          <InfoCard {...it} />
        </motion.div>
      ))}
    </div>
  );
}

function withIcons(items) {
  const list = Array.isArray(items) ? items : [];
  const iconFor = (key) => {
    switch (key) {
      case "age": return Clock;
      case "tx": return Activity;
      case "trustlines": return Layers;
      case "domain": return Globe;
      case "supply": return Blocks;
      case "flags": return Shield;
      default: return CircleDot;
    }
  };
  return list.map((it) => ({
    ...it,
    icon: it?.icon || iconFor(it?.key),
  }));
}

function InfoCard({ icon: Icon, title, value, status, tone }) {
  const badge =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/20"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-200 border-amber-400/20"
        : tone === "rose"
          ? "bg-rose-500/15 text-rose-200 border-rose-400/20"
          : "bg-slate-500/10 text-slate-200 border-white/10";

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        glassCardClassName("p-5"),
        "hover:shadow-[0_0_40px_rgba(139,92,246,0.22)]",
        "transition-shadow"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-white/8 to-white/0 ring-1 ring-white/10">
            <Icon className="h-5 w-5 text-white/75" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/85">{title}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          </div>
        </div>

        <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs", badge)}>
          {status}
        </div>
      </div>
    </motion.div>
  );
}

function WarningPanel({ text }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-rose-400/20 bg-rose-500/10 backdrop-blur-lg",
        "p-6 shadow-[0_0_50px_rgba(244,63,94,0.12)]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 ring-1 ring-rose-300/20">
          <AlertTriangle className="h-5 w-5 text-rose-200" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/90">Risk Insights</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{text}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <motion.div
            className="absolute inset-0 rounded-full border border-white/10"
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-fuchsia-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div>
          <div className="text-sm font-medium text-white/85">Analyzing on-chain data...</div>
          <div className="mt-1 text-xs text-white/55">Scoring heuristics, flags, and identity signals</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={glassCardClassName("p-5")}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/6 ring-1 ring-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-white/10" />
                  <div className="h-6 w-20 rounded bg-white/10" />
                </div>
              </div>
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
