import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
const MAX_HISTORY = 30;

export function useRiskStream(accountId) {
  const [state, setState] = useState({
    liveScore:    null,
    trend:        "stable",
    liveFactors:  null,
    lastUpdated:  null,
    streaming:    false,
    newTx:        null,
    scoreHistory: [],
  });

  const wsRef  = useRef(null);
  const idRef  = useRef(null);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "unsubscribe" })); } catch {}
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((p) => ({ ...p, streaming: false }));
  }, []);

  useEffect(() => {
    if (!accountId) { stop(); return; }
    if (idRef.current === accountId && wsRef.current?.readyState === WebSocket.OPEN) return;
    idRef.current = accountId;
    stop();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", accountId }));
      setState((p) => ({ ...p, streaming: true }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "update") {
          setState((p) => {
            const next = [
              ...p.scoreHistory,
              { score: msg.score, ts: msg.lastUpdated ?? Date.now() },
            ].slice(-MAX_HISTORY);
            return {
              liveScore:    msg.score,
              trend:        msg.trend ?? "stable",
              liveFactors:  msg.factors ?? null,
              lastUpdated:  msg.lastUpdated ?? Date.now(),
              streaming:    true,
              newTx:        msg.newTx ?? null,
              scoreHistory: next,
            };
          });
        } else if (msg.type === "stream_stopped") {
          setState((p) => ({ ...p, streaming: false }));
        }
      } catch {}
    };

    ws.onerror = () => setState((p) => ({ ...p, streaming: false }));
    ws.onclose = () => setState((p) => ({ ...p, streaming: false }));

    return stop;
  }, [accountId, stop]);

  return state;
}
