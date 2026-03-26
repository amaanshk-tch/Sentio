import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

const SCORE_COLOR = (s) =>
  s > 70 ? "rgb(52,211,153)" : s >= 40 ? "rgb(251,191,36)" : "rgb(251,113,133)";

const STROKE_CLASS = (s) =>
  s > 70 ? "[stroke:rgb(52,211,153)]" : s >= 40 ? "[stroke:rgb(251,191,36)]" : "[stroke:rgb(251,113,133)]";

export function ScoreTimeline({ history, className }) {
  if (!history || history.length < 2) return null;

  const W = 320, H = 72, PAD = 8;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const minScore = Math.max(0,  Math.min(...history.map((h) => h.score)) - 5);
  const maxScore = Math.min(100, Math.max(...history.map((h) => h.score)) + 5);
  const range    = maxScore - minScore || 1;

  const pts = history.map((h, i) => ({
    x: PAD + (i / (history.length - 1)) * innerW,
    y: PAD + ((maxScore - h.score) / range) * innerH,
    score: h.score,
    ts: h.ts,
  }));

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const area =
    d +
    ` L${pts[pts.length - 1].x.toFixed(1)},${(H - PAD).toFixed(1)}` +
    ` L${PAD},${(H - PAD).toFixed(1)} Z`;

  const latest = history[history.length - 1];
  const first  = history[0];
  const delta  = latest.score - first.score;
  const deltaLabel = delta === 0 ? "stable" : delta > 0 ? `↑ ${delta} pts` : `↓ ${Math.abs(delta)} pts`;
  const deltaColor = delta > 0 ? "text-rose-400" : delta < 0 ? "text-emerald-400" : "text-sentio-text-muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-sentio-xl border border-white/8 bg-white/3 p-4 backdrop-blur-md", className)}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-sentio-text-muted">
          Risk Timeline
        </p>
        <span className={cn("text-xs font-semibold tabular-nums", deltaColor)}>
          {deltaLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="tl-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={SCORE_COLOR(latest.score)} stopOpacity="0.18" />
            <stop offset="100%" stopColor={SCORE_COLOR(latest.score)} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[25, 50, 75].map((scoreVal) => {
          const y = PAD + ((maxScore - scoreVal) / range) * innerH;
          return y > PAD && y < H - PAD ? (
            <line key={scoreVal} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ) : null;
        })}

        <path d={area} fill="url(#tl-area-fill)" />

        <motion.path
          d={d}
          fill="none"
          stroke={SCORE_COLOR(latest.score)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === pts.length - 1 ? 3.5 : 2}
            fill={SCORE_COLOR(p.score)}
            opacity={i === pts.length - 1 ? 1 : 0.5}
          />
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-[0.6rem] text-sentio-text-subtle">
        <span>Earlier</span>
        <span>Now</span>
      </div>
    </motion.div>
  );
}
