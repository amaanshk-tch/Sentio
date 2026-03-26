import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { BreakdownGrid } from "../components/explorer/BreakdownGrid";
import { CounterpartyCard } from "../components/explorer/CounterpartyCard";
import { EmptyState } from "../components/explorer/EmptyState";
import { ErrorPanel } from "../components/explorer/ErrorPanel";
import { ExplorerHero } from "../components/explorer/ExplorerHero";
import { ExplorerNavbar } from "../components/explorer/ExplorerNavbar";
import { InsightPanel } from "../components/explorer/InsightPanel";
import { LoadingPanel } from "../components/explorer/LoadingPanel";
import { ResultsPanel } from "../components/explorer/ResultsPanel";
import { RiskFlagsPanel } from "../components/explorer/RiskFlagsPanel";
import { ScoreTimeline } from "../components/explorer/ScoreTimeline";
import { withIcons } from "../components/explorer/utils";
import { useRiskStream } from "../hooks/useRiskStream";
import { Modal } from "../ui/Modal";
import { SignalChart } from "../ui/SignalChart";
import { Card } from "../ui/Card";

function useScanAge(scannedAt) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!scannedAt) { setLabel(""); return; }
    const update = () => {
      const s = Math.round((Date.now() - scannedAt) / 1000);
      setLabel(s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [scannedAt]);
  return label;
}

export default function ExplorerPage() {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [scannedAt, setScannedAt] = useState(null);
  const reducedMotion = useReducedMotion();
  const scanAge = useScanAge(scannedAt);

  const accountId = result?.raw?.accountId ?? null;
  const { liveScore, trend, liveFactors, streaming, scoreHistory } = useRiskStream(accountId);

  const onScan = async () => {
    const input = query.trim();
    if (!input) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: input }),
        signal: controller.signal,
      }).finally(() => clearTimeout(t));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Scan failed");
      setResult(data);
      setScannedAt(Date.now());
    } catch (e) {
      setError(e?.name === "AbortError" ? "Request timed out. Please try again." : e?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const onRescan = () => onScan();
  const idle = !loading && !error && !result;

  return (
    <div className="min-h-screen bg-sentio-canvas text-sentio-text">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.75]"
        style={{
          background:
            "radial-gradient(880px 580px at 18% 0%, rgba(91,33,182,0.18), transparent 52%), radial-gradient(720px 520px at 82% 12%, rgba(34,211,238,0.08), transparent 52%)",
        }}
      />
      <div className="sentio-grid-bg pointer-events-none fixed inset-0 opacity-[0.18]" />
      {!reducedMotion ? (
        <>
          <div className="pointer-events-none fixed -left-24 top-40 h-72 w-72 rounded-full bg-violet-600/12 blur-[100px]" />
          <div className="pointer-events-none fixed -right-20 bottom-32 h-64 w-64 rounded-full bg-cyan-500/8 blur-[90px]" />
        </>
      ) : null}

      <ExplorerNavbar onOpenHelp={() => setHelpOpen(true)} />
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Using Sentio"
        description="Quick reference for scans."
      >
        <p>
          Paste a Stellar public key or <span className="font-mono text-sentio-text-secondary">CODE:ISSUER</span>. Sentio
          pulls Horizon data into a heuristic score—use it alongside your own policies.
        </p>
        <p className="mt-3 text-sentio-text-muted">Not financial or legal advice.</p>
      </Modal>

      <main className="relative mx-auto w-full max-w-(--container-max) px-(--container-padding) pb-24 pt-18">
        <ExplorerHero query={query} setQuery={setQuery} onScan={onScan} loading={loading} />

        <section className="mt-8" aria-live="polite">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.28 }}>
                <LoadingPanel />
              </motion.div>
            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.28 }}>
                <ErrorPanel message={error} />
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6"
              >
                {scannedAt && (
                  <div className="flex items-center gap-2 text-xs text-sentio-text-subtle">
                    <span>Last scanned {scanAge}</span>
                    <button
                      onClick={onRescan}
                      disabled={loading}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/8 bg-white/4 px-2.5 py-1 text-xs font-medium text-sentio-text-secondary transition hover:bg-white/8 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      Refresh
                    </button>
                  </div>
                )}

                <ResultsPanel
                  result={result}
                  liveScore={liveScore}
                  trend={trend}
                  liveFactors={liveFactors}
                  streaming={streaming}
                />

                <ScoreTimeline history={scoreHistory} />

                <RiskFlagsPanel riskFactors={result.riskFactors} />

                <InsightPanel
                  text={result.insight}
                  score={liveScore ?? result.score}
                  action={result.action}
                  confidence={result.confidence}
                />

                <div>
                  <p className="text-caption text-sentio-text-muted">Supporting detail</p>
                  <h2 className="text-h2 mt-1 text-sentio-text">Per-metric context</h2>
                  <p className="mt-1 text-sm text-sentio-text-secondary">From Horizon — grouped for quick scanning.</p>
                  <div className="mt-5">
                    <BreakdownGrid items={withIcons(result.breakdown)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
                  {result.counterparties && (
                    <CounterpartyCard counterparties={result.counterparties} />
                  )}
                  <Card interactive className="p-6 sm:p-8">
                    <SignalChart items={withIcons(result.breakdown)} />
                  </Card>
                </div>
              </motion.div>
            ) : idle ? (
              <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.32 }}>
                <EmptyState onFillExample={(value) => setQuery(value)} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
