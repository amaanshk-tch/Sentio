import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ShieldAlert, Fingerprint, Activity } from "lucide-react";

export function RiskScanSim() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="relative z-20 flex w-full max-w-[280px] flex-col gap-3 rounded-2xl border border-foreground/10 bg-sentio-elevated/90 p-5 shadow-sentio-glow-accent ring-1 ring-accent/20 backdrop-blur-xl"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent ring-1 ring-accent/30">
            <Activity className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold tracking-wider text-accent">
              ACTIVE SCAN
            </p>
            <p className="font-mono text-xs text-sentio-text-muted">GABC...9XQZ</p>
          </div>
        </div>
      </div>

      {/* Animated phases */}
      <div className="relative flex h-20 items-center overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              key="p0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex w-full flex-col gap-2"
            >
              <p className="text-sm font-medium text-foreground">Analyzing ledgers...</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
          {phase === 1 && (
            <motion.div
              key="p1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex w-full flex-col gap-2"
            >
              <p className="text-sm font-medium text-foreground">
                Intercepting issuer history...
              </p>
              <div className="flex items-center gap-2 text-xs text-sentio-warning">
                <Fingerprint className="h-3.5 w-3.5" />
                <span>Domain verification failed</span>
              </div>
            </motion.div>
          )}
          {phase === 2 && (
            <motion.div
              key="p2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full rounded-lg bg-destructive/10 p-3 ring-1 ring-destructive/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold tracking-tight text-destructive">
                  Score: 24 / 100
                </span>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </div>
              <p className="mt-1 text-[0.7rem] leading-tight text-destructive/80">
                High risk flag detected. Abort interaction.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
