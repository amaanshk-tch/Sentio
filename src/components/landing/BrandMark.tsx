import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface BrandMarkProps {
  to?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { wrap: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-base" },
  md: { wrap: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", text: "text-lg" },
  lg: { wrap: "h-11 w-11 rounded-2xl", icon: "h-5 w-5", text: "text-xl" },
};

export function BrandMark({ to, size = "md" }: BrandMarkProps) {
  const s = sizes[size];

  const inner = (
    <>
      <div
        className={`grid place-items-center bg-linear-to-br from-cyan-500/25 to-teal-500/15 ring-1 ring-cyan-400/20 ${s.wrap}`}
      >
        <Sparkles className={`text-cyan-200 ${s.icon}`} aria-hidden />
      </div>
      <span className={`font-semibold tracking-tight ${s.text}`}>
        <span className="bg-linear-to-r from-cyan-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
          Sentio
        </span>
      </span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-flex items-center gap-3 rounded-xl outline-none transition-opacity hover:opacity-95"
      >
        {inner}
      </Link>
    );
  }

  return <div className="inline-flex items-center gap-3">{inner}</div>;
}
