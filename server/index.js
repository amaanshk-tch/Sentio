import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

import { rateLimitMiddleware } from "./utils/rateLimit.js";
import { scanHandler } from "./api/scan.js";
import { contractScanHandler } from "./api/contract.js";
import { setupWebSocket } from "./ws/stream.js";

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

app.use(cors());
app.use(express.json());

/* ─── WebSocket Live Stream ──────────────────────────────────────────────── */
setupWebSocket(wss);

/* ─── API Routes ─────────────────────────────────────────────────────────── */
app.post("/api/scan", rateLimitMiddleware(30), scanHandler);
app.post("/api/scan/contract", rateLimitMiddleware(30), contractScanHandler);

app.get("/api/health", (_, res) => res.json({ ok: true }));

/* ─── Start Server ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Sentio server running on http://localhost:${PORT}`));
