import { useState, useEffect } from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 inline-flex items-center rounded-md p-1 text-sentio-text-muted transition hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-sentio-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sentio-shimmer rounded-lg ${className}`} />;
}

export function RateLimitCountdown({ retryAfter, onDismiss }: { retryAfter: number; onDismiss: () => void }) {
  const [timeLeft, setTimeLeft] = useState(retryAfter);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <motion.div
      key="error"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mb-8 mx-auto max-w-2xl flex items-start gap-4 rounded-2xl border border-sentio-warning/30 bg-sentio-warning/10 p-5 shadow-sentio-md"
    >
      <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-sentio-warning" />
      <div className="flex-1">
        <p className="text-base font-bold text-sentio-warning">Too many requests</p>
        <p className="mt-1 text-sm text-sentio-warning/90">
          {timeLeft > 0 ? `Please wait ${timeLeft}s before trying again.` : "You can try searching again."}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs font-semibold uppercase tracking-wider text-sentio-warning hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
      >
        Dismiss
      </button>
    </motion.div>
  );
}
