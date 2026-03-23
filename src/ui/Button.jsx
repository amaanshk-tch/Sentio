import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";

const MotionLink = motion(Link);

export const buttonClasses = ({ variant = "primary" } = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight",
    "transition-[transform,box-shadow,background-color,border-color,filter] duration-200 ease-out",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/80",
    "disabled:pointer-events-none disabled:opacity-45",
    variant === "primary" &&
      cn(
        "bg-sentio-primary text-white shadow-[var(--shadow-sentio-glow)]",
        "hover:bg-sentio-primary-hover hover:shadow-[0_0_32px_-6px_rgba(124,58,237,0.55)] hover:brightness-[1.02]",
        "active:brightness-[0.96] active:shadow-[var(--shadow-sentio-glow)]"
      ),
    variant === "secondary" &&
      cn(
        "border border-sentio-border-strong bg-sentio-surface/90 text-sentio-text shadow-sentio-sm backdrop-blur-md",
        "hover:border-white/25 hover:bg-sentio-surface-hover hover:shadow-sentio-md",
        "active:brightness-[0.97]"
      ),
    variant === "ghost" &&
      "text-sentio-text-secondary hover:bg-white/[0.06] hover:text-sentio-text active:bg-white/[0.08]",
    variant === "danger" &&
      "border border-rose-400/25 bg-sentio-danger-bg text-rose-100 hover:bg-rose-500/15 active:brightness-95"
  );

export const Button = forwardRef(function Button({ className, variant = "primary", disabled, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={cn(buttonClasses({ variant }), className)}
      {...props}
    />
  );
});

export function ButtonLink({ to, variant = "primary", className, children, ...props }) {
  return (
    <MotionLink
      to={to}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={cn(buttonClasses({ variant }), className)}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
