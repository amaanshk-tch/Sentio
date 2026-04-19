import { getHorizonUrl, isAccount } from "../utils/stellarContext.js";
import { runScan } from "../api/scan.js";

const STREAM_TTL_MS    = 5 * 60 * 1000;
const MAX_CONNECTIONS  = 100;
const MAX_PER_IP       = 5;

let activeConnections = 0;
const ipConnectionCount = new Map();

export function setupWebSocket(wss) {
  wss.on("connection", (ws, req) => {
    if (activeConnections >= MAX_CONNECTIONS) {
      ws.close(1008, "Too many connections");
      return;
    }

    let ip = req.socket.remoteAddress || "unknown";
    if (process.env.TRUST_PROXY) {
      ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || ip;
    }

    const ipCount = ipConnectionCount.get(ip) ?? 0;
    if (ipCount >= MAX_PER_IP) {
      ws.close(1008, "Too many connections from your IP");
      return;
    }

    activeConnections++;
    ipConnectionCount.set(ip, ipCount + 1);

    let horizonReader    = null;
    let streamController = null;
    let killTimer        = null;
    let lastScore        = null;
    let activeNetwork    = "testnet"; // tracks network for this connection

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

      const horizonUrl = getHorizonUrl(activeNetwork);
      const url = `${horizonUrl}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&cursor=now`;
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
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '"hello"' || payload === "bye") continue;
            
            let tx;
            try { tx = JSON.parse(payload); } catch { continue; }
            if (!tx?.id) continue;

            resetKillTimer();
            
            try {
              const controller = new AbortController();
              const t = setTimeout(() => controller.abort(), 12_000);
              const updated = await runScan(accountId, { signal: controller.signal, prevScore: lastScore, network: activeNetwork });
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

    let messageCount = 0;
    let windowStart = Date.now();

    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - windowStart > 1000) {
        windowStart = now;
        messageCount = 0;
      }
      messageCount++;
      if (messageCount > 4) {
        ws.close(1008, "Message rate limit exceeded");
        return;
      }

      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "subscribe" && msg.accountId) {
          const id = String(msg.accountId).trim().toUpperCase();
          const net = msg.network === "mainnet" ? "mainnet" : "testnet";
          if (isAccount(id)) {
            if (net !== activeNetwork) {
              activeNetwork = net;
              lastScore = null; // reset score baseline when network changes
            }
            startStream(id);
          }
        } else if (msg.type === "unsubscribe") {
          cleanup();
        }
      } catch {}
    });

    function releaseConnection() {
      cleanup();
      activeConnections = Math.max(0, activeConnections - 1);
      const current = ipConnectionCount.get(ip) ?? 1;
      if (current <= 1) {
        ipConnectionCount.delete(ip);
      } else {
        ipConnectionCount.set(ip, current - 1);
      }
    }

    ws.on("close", releaseConnection);
    ws.on("error", releaseConnection);
  });
}