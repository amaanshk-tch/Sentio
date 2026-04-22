import { useState, useRef, useEffect } from "react";
import type { ScanResult } from "./utils";

export type StreamStatus = "idle" | "live" | "stopped";

export function useLiveStream(
  accountId: string | null,
  network: "mainnet" | "testnet",
  onUpdate: (patch: Partial<ScanResult>) => void,
  onUserCount?: (total: number) => void,
): { status: StreamStatus; lastTxId: string | null } {
  const wsRef   = useRef<WebSocket | null>(null);
  const [status, setStatus]   = useState<StreamStatus>("idle");
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onUserCountRef = useRef(onUserCount);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onUserCountRef.current = onUserCount;
  }, [onUpdate, onUserCount]);

  useEffect(() => {
    wsRef.current?.close();
    wsRef.current = null;

    let mounted = true;
    setTimeout(() => {
      if (mounted) {
        setStatus("idle");
        setLastTxId(null);
      }
    }, 0);

    if (!accountId) return () => { mounted = false; };

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const backendWs = import.meta.env.VITE_API_WS_URL || `${protocol}://${window.location.host}`;
    const ws = new WebSocket(`${backendWs}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", accountId, network }));
      setStatus("live");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "update") {
          const { newTx, ...scanPatch } = msg;
          if (newTx?.id) setLastTxId(newTx.id as string);
          onUpdateRef.current(scanPatch as Partial<ScanResult>);
        } else if (msg.type === "stream_stopped") {
          setStatus("stopped");
        } else if (msg.type === "user_count" && typeof msg.total === "number") {
          onUserCountRef.current?.(msg.total);
        }
      } catch (err) {
        console.warn("WebSocket parse error", err);
      }
    };

    ws.onerror  = () => setStatus("stopped");
    ws.onclose  = () => setStatus((s) => s === "live" ? "stopped" : s);

    return () => {
      mounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe" }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [accountId, network]);

  return { status, lastTxId };
}
