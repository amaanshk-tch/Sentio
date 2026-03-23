import {
  Activity,
  Blocks,
  CircleDot,
  Clock,
  Globe,
  Layers,
  Shield,
} from "lucide-react";

export function truncateMiddle(str, start = 10, end = 10) {
  if (!str) return "";
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

export function scoreLabel(score) {
  if (score > 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

export function scoreColor(score) {
  if (score > 70) return "emerald";
  if (score >= 40) return "amber";
  return "rose";
}

export function colorClasses(color) {
  switch (color) {
    case "emerald":
      return {
        text: "text-emerald-300",
        badge: "border-emerald-400/25 bg-emerald-500/12 text-emerald-100",
        glow: "shadow-[0_0_48px_rgba(52,211,153,0.14)]",
      };
    case "amber":
      return {
        text: "text-amber-200",
        badge: "border-amber-400/25 bg-amber-500/12 text-amber-100",
        glow: "shadow-[0_0_48px_rgba(251,191,36,0.12)]",
      };
    default:
      return {
        text: "text-rose-200",
        badge: "border-rose-400/25 bg-rose-500/12 text-rose-100",
        glow: "shadow-[0_0_48px_rgba(251,113,133,0.12)]",
      };
  }
}

export function withIcons(items) {
  const list = Array.isArray(items) ? items : [];
  const iconFor = (key) => {
    switch (key) {
      case "age":
        return Clock;
      case "tx":
        return Activity;
      case "trustlines":
        return Layers;
      case "domain":
        return Globe;
      case "supply":
        return Blocks;
      case "flags":
        return Shield;
      default:
        return CircleDot;
    }
  };
  return list.map((it) => ({
    ...it,
    icon: it?.icon || iconFor(it?.key),
  }));
}

export function toneCardShell(tone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/20 bg-emerald-500/[0.05] ring-emerald-500/10";
    case "amber":
      return "border-amber-500/20 bg-amber-500/[0.06] ring-amber-500/10";
    case "rose":
      return "border-rose-500/20 bg-rose-500/[0.06] ring-rose-500/10";
    default:
      return "border-white/[0.08] bg-white/[0.03] ring-white/[0.04]";
  }
}

export function toneIconWrap(tone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
    case "amber":
      return "bg-amber-500/15 text-amber-100 ring-amber-400/25";
    case "rose":
      return "bg-rose-500/15 text-rose-100 ring-rose-400/25";
    default:
      return "bg-white/[0.08] text-sentio-text ring-white/[0.1]";
  }
}
