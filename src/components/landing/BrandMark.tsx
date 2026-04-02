import { Link } from "react-router-dom";

interface BrandMarkProps {
  size?: "xs" | "sm" | "md" | "lg";
  to?: string;
}

const sizes = {
  xs: { wrap: "h-5 w-5 rounded-md", icon: "h-3 w-3", text: "text-sm" },
  sm: { wrap: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-xl" },
  md: { wrap: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", text: "text-2xl" },
  lg: { wrap: "h-11 w-11 rounded-2xl", icon: "h-5 w-5", text: "text-3xl" },
};

export function BrandMark({ to, size = "md" }: BrandMarkProps) {
  const s = sizes[size];

  const inner = (
    <span className={`font-semibold tracking-tight ${s.text}`}>
      <span className="bg-linear-to-r from-cyan-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
        Sentio
      </span>
    </span>
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
