import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { WebSocketServer } from "ws";

import { rateLimitMiddleware } from "./utils/rateLimit.js";
import { requireAdminToken } from "./utils/auth.js";
import { scanHandler } from "./api/scan.js";
import { contractScanHandler } from "./api/contract.js";
import { historyHandler, flagsHandler, reportHandler, setRiskHandler } from "./api/registryApi.js";
import { setupWebSocket } from "./ws/stream.js";

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

// Trust reverse-proxy headers (Render, Railway, etc.) so rate-limiting uses the real IP
app.set("trust proxy", 1);

// Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.)
app.use(helmet());

// Restrict CORS to your frontend origin only
// Added standard frontend ports for fallback
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ["http://localhost:5173", "http://localhost:5174"];
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "sentio-admin-token", "sentio_admin_token"],
}));

app.use(express.json({ limit: "32kb" }));

/* ─── WebSocket Live Stream ──────────────────────────────────────────────── */
setupWebSocket(wss);

/* ─── Public API Routes ──────────────────────────────────────────────────── */
app.post("/api/scan", rateLimitMiddleware(30), scanHandler);
app.post("/api/scan/contract", rateLimitMiddleware(30), contractScanHandler);

app.get("/api/registry/history/:address", historyHandler);
app.get("/api/registry/flags/:address", flagsHandler);
app.post("/api/registry/report", rateLimitMiddleware(10), reportHandler);

/* ─── Admin Routes (require admin authentication) ───────────────────────── */
app.post("/api/registry/set-risk", requireAdminToken, setRiskHandler);

app.get("/api/health", (_, res) => res.json({ ok: true }));

/* ─── Start Server ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Sentio server running on http://localhost:${PORT}`));
