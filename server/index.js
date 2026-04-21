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
import { historyHandler, flagsHandler, reportHandler, setRiskHandler, clearFlagsHandler, removeRiskHandler, submitHandler } from "./api/registryApi.js";
import { connectUserHandler, logSearchHandler, getSearchHistoryHandler, listUsersHandler, getUserCountHandler } from "./api/users.js";
import { setupWebSocket } from "./ws/stream.js";

/* ─── CORS / Origin config (must be declared before WebSocketServer) ────────── */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(",")
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:8080"];

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 4096,
  verifyClient: ({ origin }, cb) => {
    if (!origin) return cb(true);
    const allowed = ALLOWED_ORIGIN.some((o) => origin.startsWith(o));
    cb(allowed, 403, "Forbidden");
  },
});

const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", trustProxy === "true" ? 1 : (trustProxy === "1" ? 1 : trustProxy));
} else {
  app.set("trust proxy", false);
}
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],       // add "'unsafe-inline'" only if Vite build requires it
      styleSrc:  ["'self'", "'unsafe-inline'"],
      imgSrc:    ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://horizon.stellar.org",
        "https://horizon-testnet.stellar.org",
        "https://soroban-testnet.stellar.org",
        "https://soroban-rpc.mainnet.stellar.gateway.fm",
        "https://api.stellar.expert",
        "wss:", // for WebSocket
      ],
      fontSrc:   ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // may need to disable for Freighter extension
}));

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "32kb" }));

setupWebSocket(wss);

/* ─── Public API Routes ──────────────────────────────────────────────────── */
app.post("/api/scan",          rateLimitMiddleware("scan", 30), scanHandler);
app.post("/api/scan/contract", rateLimitMiddleware("scan", 30), contractScanHandler);

/* ─── User Wallet Routes ─────────────────────────────────────────────────── */
app.post("/api/users/connect",              rateLimitMiddleware("registry-read", 60), connectUserHandler);
app.post("/api/users/search",               rateLimitMiddleware("registry-read", 60), logSearchHandler);
app.get("/api/users/history/:walletAddress", rateLimitMiddleware("registry-read", 60), getSearchHistoryHandler);
app.get("/api/users/list",                  requireAdminToken, listUsersHandler);
app.get("/api/users/count",                 rateLimitMiddleware("registry-read", 60), getUserCountHandler);

app.get("/api/registry/history/:address", rateLimitMiddleware("registry-read", 60), historyHandler);
app.get("/api/registry/flags/:address",   rateLimitMiddleware("registry-read", 60), flagsHandler);

/* ─── Admin Routes (require admin token) ────────────────────────────────── */

app.post("/api/registry/verify-token", requireAdminToken, (req, res) => res.json({ valid: true }));

app.post("/api/registry/verify-admin", requireAdminToken, (req, res) => {
  const { signerAddress } = req.body;
  if (!signerAddress) return res.status(400).json({ error: "Missing signerAddress." });
  const ADMIN_ADDRESS = process.env.SENTIO_ADMIN_ADDRESS;
  if (!ADMIN_ADDRESS) return res.status(500).json({ error: "SENTIO_ADMIN_ADDRESS not configured." });
  if (signerAddress !== ADMIN_ADDRESS) {
    return res.status(403).json({ authorized: false, error: "Not authorized. Connected wallet is not the contract admin." });
  }
  return res.json({ authorized: true });
});

app.post("/api/registry/report",      requireAdminToken, rateLimitMiddleware("admin-write", 5), reportHandler);
app.post("/api/registry/set-risk",    requireAdminToken, rateLimitMiddleware("admin-write", 5), setRiskHandler);
app.post("/api/registry/clear-flags", requireAdminToken, rateLimitMiddleware("admin-write", 5), clearFlagsHandler);
app.post("/api/registry/remove-risk", requireAdminToken, rateLimitMiddleware("admin-write", 5), removeRiskHandler);
app.post("/api/registry/submit",      requireAdminToken, rateLimitMiddleware("admin-write", 5), submitHandler);

app.get("/api/health", (_, res) => res.json({ ok: true }));

/* ─── Start Server ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`Sentio server running on http://localhost:${PORT}`));

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Kill the existing process and try again.`);
    process.exit(1);
  } else {
    throw err;
  }
});