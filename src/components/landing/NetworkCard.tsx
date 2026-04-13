import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

const HORIZON = "https://horizon.stellar.org";

interface NetworkMetrics {
  ledger: number;
  txSuccessPct: number;
  ops24h: number;
  avgCloseTime: number;
  status: "Stable" | "Degraded" | "Unknown";
  updatedAt: Date;
  ledgerCount: number;
}

async function fetchMetrics(): Promise<NetworkMetrics> {
  const sampleRes = await fetch(`${HORIZON}/ledgers?order=desc&limit=200`);
  if (!sampleRes.ok) throw new Error("Horizon error");
  const sampleData = await sampleRes.json();
  const ledgers: {
    sequence: number;
    closed_at: string;
    successful_transaction_count: number;
    failed_transaction_count: number;
    operation_count: number;
  }[] = sampleData._embedded?.records ?? [];

  if (ledgers.length === 0) throw new Error("No ledger data");

  const latestSequence = ledgers[0].sequence;

  let ops24h = 0;
  try {
    const timestamp24hAgo = Math.floor((Date.now() - 86_400_000) / 1000);
    const anchorRes = await fetch(`https://api.stellar.expert/explorer/public/ledger/find-by-time?timestamp=${timestamp24hAgo}`);
    if (!anchorRes.ok) throw new Error("Stellar Expert error");
    const { sequence: anchorSequence } = await anchorRes.json();
    
    const totalLedgers = latestSequence - anchorSequence;
    const avgOps = ledgers.reduce((s, l) => s + l.operation_count, 0) / ledgers.length;
    ops24h = Math.round(avgOps * totalLedgers);
  } catch {
    const avgCloseTimeFallback = 5;
    const avgOpsFallback = ledgers.reduce((s, l) => s + l.operation_count, 0) / ledgers.length;
    ops24h = Math.round(avgOpsFallback * ((24 * 3600) / avgCloseTimeFallback));
  }

  const latestTs = new Date(ledgers[0].closed_at).getTime();
  const oldestTs = new Date(ledgers[ledgers.length - 1].closed_at).getTime();
  const avgCloseTime = ledgers.length > 1 ? (latestTs - oldestTs) / (ledgers.length - 1) / 1000 : 5;

  const totalSuccess = ledgers.reduce((s, l) => s + l.successful_transaction_count, 0);
  const totalTx = totalSuccess + ledgers.reduce((s, l) => s + l.failed_transaction_count, 0);
  const txSuccessPct = totalTx > 0 ? Math.round((totalSuccess / totalTx) * 100) : 100;

  const status: NetworkMetrics["status"] = avgCloseTime < 8 ? "Stable" : avgCloseTime < 15 ? "Degraded" : "Unknown";

  return {
    ledger: latestSequence,
    txSuccessPct,
    ops24h,
    avgCloseTime: Math.round(avgCloseTime * 10) / 10,
    status,
    updatedAt: new Date(),
    ledgerCount: ledgers.length,
  };
}

function fmtLarge(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function useCountUp(target: number | null, duration = 900) {
  const [val, setVal] = useState<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === null) { 
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVal(null); 
      return; 
    }
    const from = prevRef.current;
    prevRef.current = target;
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + ((target as number) - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}


const REFRESH_INTERVAL = 120;

function CountdownRing({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      onClick={onRefresh}
      title="Refresh now"
      aria-label="Refresh network data"
      className="group relative flex h-5 w-5 items-center justify-center rounded-lg bg-foreground/5 transition-colors hover:bg-foreground/10"
    >
      <RefreshCw
        className="h-3 w-3 text-sentio-text-muted transition-colors group-hover:text-foreground"
      />
    </button>
  );
}

function StatTile({
  label, value, sub, loading,
}: {
  label: string;
  value: string | null;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-foreground/6 bg-background/30 p-3.5 backdrop-blur-sm">
      <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">
        {label}
      </span>
      {loading || value === null ? (
        <span className="sentio-shimmer mt-1 inline-block h-6 w-20 rounded" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="font-mono text-xl font-bold tracking-tight text-foreground"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      )}
      {sub && <span className="mt-0.5 text-[0.6rem] text-sentio-text-muted">{sub}</span>}
    </div>
  );
}

function StatusTile({ status }: { status: NetworkMetrics["status"] | null }) {
  const color =
    status === "Stable"   ? "hsl(43 96% 56%)"  :
    status === "Degraded" ? "hsl(25 95% 55%)"  : "hsl(0 0% 50%)";
  const badgeCls =
    status === "Stable"   ? "border-yellow-500/25 bg-yellow-500/10"  :
    status === "Degraded" ? "border-orange-500/25 bg-orange-500/10" :
    "border-foreground/10 bg-foreground/5";

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-foreground/6 bg-background/30 p-3.5 backdrop-blur-sm">
      <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">
        Network Status
      </span>
      {status === null ? (
        <span className="sentio-shimmer mt-1 inline-block h-6 w-16 rounded" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeCls}`}
            style={{ color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 5px ${color}` }}
            />
            {status}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}

function LiveTimeAgo({ date }: { date: Date }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      setSeconds(Math.floor((Date.now() - date.getTime()) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [date]);

  if (seconds < 60) return <span>{seconds}s ago</span>;
  return <span>{Math.floor(seconds / 60)}m ago</span>;
}

export function NetworkCard() {
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    
    try {
      const m = await fetchMetrics();
      setMetrics(m);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => { load(); }, [tick, load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setTick(t => t + 1);
    }, REFRESH_INTERVAL * 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTick(t => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refresh = useCallback(() => setTick(t => t + 1), []);
  const ledgerAnimated = useCountUp(metrics?.ledger ?? null);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-foreground/8 bg-sentio-elevated/90 shadow-sentio-glow backdrop-blur-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(263_70%_58%/0.07),transparent_60%)]" />

      <div className="relative z-10 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[0.6rem] font-semibold tracking-widest text-sentio-text-muted">
              STELLAR NETWORK
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentio-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 animate-live-beat rounded-full bg-sentio-success shadow-[0_0_10px_hsl(var(--sentio-success))]" />
            </span>
            <span className="text-[0.65rem] font-bold tracking-wide text-sentio-success">LIVE</span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground">Live Network Snapshot</p>
          <p className="text-[0.65rem] text-sentio-text-muted">
            Ecosystem scale, activity, and health — before you explore.
          </p>
        </div>

        {error && !loading && (
          <div className="mb-3 rounded-xl border border-sentio-danger/20 bg-sentio-danger/8 px-3 py-2 text-xs text-sentio-danger">
            Could not reach Horizon. Retrying…
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Current Ledger"
            value={ledgerAnimated !== null ? fmtLarge(ledgerAnimated) : null}
            loading={loading && metrics === null}
          />
          <StatTile
            label="Transaction Success"
            value={metrics ? `${metrics.txSuccessPct}%` : null}
            sub={metrics ? `last ${metrics.ledgerCount} ledgers` : "computing..."}
            loading={loading && metrics === null}
          />
          <StatTile
            label="Ops/Day (est.)"
            value={metrics ? fmtLarge(metrics.ops24h) : null}
            sub="based on actual 24h ledger span"
            loading={loading && metrics === null}
          />
          <StatusTile status={metrics?.status ?? null} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[0.6rem] text-sentio-text-muted">
              Horizon data
              {metrics && (
                <>
                  {" · "}Updated <LiveTimeAgo date={metrics.updatedAt} />
                  {loading && <span className="opacity-60"> (refreshing…)</span>}
                </>
              )}
            </span>
            {metrics && <CountdownRing key={tick} onRefresh={refresh} />}
          </div>
          <a
            href="https://stellar.expert"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[0.6rem] text-sentio-text-muted transition hover:text-foreground"
          >
            Inspect in explorer
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
