import { useEffect, useId, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { BadgeCheck, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "../../lib/cn";
import { colorClasses, scoreColor, scoreLabel } from "./utils";

const TREND_ICON = {
  up:     { Icon: TrendingUp,   cls: "text-rose-400",    label: "Risk rising"   },
  down:   { Icon: TrendingDown, cls: "text-emerald-400", label: "Risk falling"  },
  stable: { Icon: Minus,        cls: "text-sentio-text-muted", label: "Stable"  },
};

export function RiskGauge({ score, trend = "stable", live = false }) {
  const gid     = useId();
  const radius  = 86;
  const stroke  = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference    = 2 * Math.PI * normalizedRadius;

  const tone    = scoreColor(score);
  const classes = colorClasses(tone);

  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current ?? 0;
    prev.current = score;
    const controls = animate(from, score, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [score]);

  const progress   = display / 100;
  const dashOffset = circumference * (1 - progress);
  const gradId     = `${gid.replace(/:/g, "")}-ring`;
  const trendCfg   = TREND_ICON[trend] ?? TREND_ICON.stable;
  const TrendIcon  = trendCfg.Icon;

  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative grid place-items-center", classes.glow)} style={{ width: 220, height: 220 }}>
        <div className="absolute inset-0 rounded-full bg-linear-to-br from-white/7 to-transparent blur-sm" />

        {live && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-violet-400/30"
            animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.03, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <svg width="220" height="220" className="relative" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="rgb(167 139 250)" />
              <stop offset="50%"  stopColor="rgb(236 72 153)" />
              <stop offset="100%" stopColor="rgb(34 211 238)" />
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r={normalizedRadius} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="transparent" />
          <motion.circle
            cx="110" cy="110" r={normalizedRadius}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ rotate: -90, transformOrigin: "110px 110px" }}
          />
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-5xl font-semibold tabular-nums tracking-tight text-sentio-text">{display}</div>
            <div className="mt-1 text-sm font-medium text-sentio-text-muted">Risk score</div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <div className={cn("text-sm font-semibold", classes.text)}>{scoreLabel(score)}</div>

        <div className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium", trendCfg.cls)}>
          <TrendIcon className="h-3 w-3" aria-hidden />
          {trendCfg.label}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium text-sentio-text-secondary">
          <BadgeCheck className="h-3.5 w-3.5 text-sentio-accent" aria-hidden />
          0–100 composite
        </div>
      </div>
    </div>
  );
}
