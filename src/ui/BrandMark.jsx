import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "../lib/cn";

export function BrandMark({ to, className, size = "md" }) {
  const sizes = {
    sm: { wrap: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-base" },
    md: { wrap: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", text: "text-lg" },
    lg: { wrap: "h-11 w-11 rounded-2xl", icon: "h-5 w-5", text: "text-xl" },
  };
  const s = sizes[size] ?? sizes.md;

  const inner = (
    <>
      <div
        className={cn(
          "grid place-items-center bg-linear-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-white/12",
          s.wrap
        )}
      >
        <Sparkles className={cn("text-violet-100", s.icon)} aria-hidden />
      </div>
      <span className={cn("font-semibold tracking-tight", s.text)}>
        <span className="bg-linear-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
          Sentio
        </span>
      </span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn("inline-flex items-center gap-3 rounded-xl outline-none transition-opacity hover:opacity-95", className)}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cn("inline-flex items-center gap-3", className)}>{inner}</div>;
}
