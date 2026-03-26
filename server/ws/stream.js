import { HORIZON_URL, isAccount } from "../utils/stellarContext.js";
import { runScan } from "../api/scan.js";

const STREAM_TTL_MS = 5 * 60 * 1000; // 5 minutes live

/**
 * Initializes the WebSocket server bindings for live risk stream updates.
 */
export function setupWebSocket(wss) {
  wss.on("connection", (ws) => {
    let horizonReader    = null;
    let streamController = null;
    let killTimer        = null;
    let lastScore        = null;

    function cleanup() {
      if (killTimer)        { clearTimeout(killTimer); killTimer = null; }
      if (streamController) { streamController.abort(); streamController = null; }
      horizonReader = null;
    }

    function resetKillTimer() {
      if (killTimer) clearTimeout(killTimer);
      killTimer = setTimeout(() => {
        try { ws.send(JSON.stringify({ type: "stream_stopped", reason: "timeout" })); } catch {}
        cleanup();
      }, STREAM_TTL_MS);
    }

    async function startStream(accountId) {
      cleanup();
      streamController = new AbortController();
      resetKillTimer();

      const url = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&cursor=now`;
      try {
        const res = await fetch(url, {
          signal: streamController.signal,
          headers: { accept: "text/event-stream" },
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        horizonReader = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Decode chunk incrementally
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // incomplete line remains in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '"hello"' || payload === "bye") continue;
            
            let tx;
            try { tx = JSON.parse(payload); } catch { continue; }
            if (!tx?.id) continue;

            resetKillTimer(); // refresh 5m limit
            
            try {
              // On new transaction, fire off a fast score recalculation
              const controller = new AbortController();
              const t = setTimeout(() => controller.abort(), 12_000);
              const updated = await runScan(accountId, { signal: controller.signal, prevScore: lastScore });
              clearTimeout(t);
              
              lastScore = updated.score;
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: "update", newTx: tx, ...updated }));
              }
            } catch (e) { 
              console.error("[ws rescan error]", e?.message); 
            }
          }
        }
      } catch (e) {
        if (e?.name !== "AbortError") console.error("[horizon stream error]", e?.message);
      }
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "subscribe" && msg.accountId) {
          const id = String(msg.accountId).trim().toUpperCase();
          if (isAccount(id)) {
            startStream(id);
          }
        } else if (msg.type === "unsubscribe") {
          cleanup();
        }
      } catch {}
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}
