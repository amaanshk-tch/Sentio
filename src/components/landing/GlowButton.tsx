import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface GlowButtonProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function GlowButton({ to, children, className = "" }: GlowButtonProps) {
  return (
    <Link
      to={to}
      className={`glow-btn group relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-primary-foreground transition-shadow hover:shadow-[0_0_32px_-4px_hsl(185_85%_45%/0.45)] ${className}`}
    >
      <span className="glow-btn-border" aria-hidden />
      <span className="glow-btn-fill" aria-hidden />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </Link>
  );
}
