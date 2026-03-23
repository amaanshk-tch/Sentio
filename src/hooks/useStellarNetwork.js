import { useState, useEffect, useCallback, useRef } from "react";

const HORIZON            = "https://horizon.stellar.org";
const REFRESH_MS         = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("request-timeout")), ms)
    ),
  ]);
}

async function safeFetch(url) {
  try {
    const res = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Computes the average time between consecutive ledger closings (in seconds).
 * Uses absolute value in case records are not perfectly ordered.
 */
function computeAvgClose(records) {
  if (!records || records.length < 2) return null;
  const diffs = [];
  for (let i = 0; i < records.length - 1; i++) {
    const ms = Math.abs(
      new Date(records[i].closed_at) - new Date(records[i + 1].closed_at)
    );
    if (ms > 0 && ms < 60_000) diffs.push(ms / 1000); // discard outliers > 60s
  }
  if (!diffs.length) return null;
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

/**
 * Derives a human-readable network health status from observable metrics.
 *   healthy  — avg close ≤ 8s AND success rate ≥ 90 %
 *   stable   — avg close ≤ 20s
 *   degraded — anything worse
 */
function deriveHealth(avgClose, successRate) {
  if (avgClose === null) return { label: "Unknown", level: "unknown" };
  const healthyClose    = avgClose <= 7;
  const healthySuccess  = successRate === null || successRate >= 0.9;
  if (healthyClose && healthySuccess) return { label: "Healthy", level: "healthy" };
  if (avgClose <= 20)                 return { label: "Stable",  level: "stable"  };
  return                                     { label: "Degraded", level: "degraded" };
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */
/**
 * @returns {{
 *   status: "loading" | "refreshing" | "success" | "error",
 *   data: {
 *     latestLedger: number | null,
 *     successRate: number | null,
 *     ops24h: number | null,
 *     avgLedgerClose: number | null,
 *     networkHealth: { label: string, level: string },
 *   } | null,
 *   updatedAt: number | null,
 *   refresh: () => void,
 * }}
 */
export function useStellarNetwork() {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    updatedAt: null,
    error: null,
  });

  const abortedRef = useRef(false);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    abortedRef.current = false;

    setState((prev) => ({
      ...prev,
      status: prev.data ? "refreshing" : "loading",
    }));

    /* ── Step 1: Horizon (core metrics — required) ── */
    const [root, ledgersPayload] = await Promise.all([
      safeFetch(`${HORIZON}/`),
      safeFetch(`${HORIZON}/ledgers?order=desc&limit=50`),
    ]);

    if (abortedRef.current) return;

    if (!root || !ledgersPayload) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Unable to reach the Stellar network. Please try again.",
      }));
      return;
    }

    const records = ledgersPayload._embedded?.records ?? [];

    const avgClose = computeAvgClose(records);

    // Tx success rate
    const totalTx   = records.reduce((s, l) => s + (l.successful_transaction_count ?? 0) + (l.failed_transaction_count ?? 0), 0);
    const successTx = records.reduce((s, l) => s + (l.successful_transaction_count ?? 0), 0);
    const successRate = totalTx > 0 ? successTx / totalTx : null;

    // 24h operation extrapolation from recent sample
    let ops24h = null;
    if (records.length >= 2) {
      const totalOps = records.reduce((s, l) => s + (l.operation_count ?? 0), 0);
      const spanSec  = Math.abs(
        (new Date(records[0].closed_at) - new Date(records[records.length - 1].closed_at)) / 1000
      );
      if (spanSec > 30) {
        ops24h = Math.round((totalOps / spanSec) * 86_400);
      }
    }

    if (abortedRef.current) return;

    setState({
      status: "success",
      error: null,
      data: {
        latestLedger:   root.history_latest_ledger ?? null,
        successRate:    successRate !== null ? +(successRate * 100).toFixed(1) : null,
        ops24h,
        avgLedgerClose: avgClose !== null ? +avgClose.toFixed(2) : null,
        networkHealth:  deriveHealth(avgClose, successRate),
      },
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_MS);
    return () => {
      abortedRef.current = true;
      clearInterval(intervalRef.current);
    };
  }, [load]);

  return { ...state, refresh: load };
}
