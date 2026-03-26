import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import {
  verifyHomeDomain,
  analyzeTransactionPatterns,
  analyzeTrustlines,
  computeConfidence,
  computeRisk,
} from "./riskEngine.js";

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

app.use(cors());
app.use(express.json());

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
const STREAM_TTL_MS = 5 * 60 * 1000;

/* ─── Rate Limiting ──────────────────────────────────────────────────────── */
const rateWindows = new Map();
function rateLimitMiddleware(maxPerMinute = 30) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const win = rateWindows.get(ip);
    if (!win || now > win.resetAt) { rateWindows.set(ip, { count: 1, resetAt: now + 60_000 }); return next(); }
    if (win.count >= maxPerMinute) return res.status(429).json({ error: "Too many requests. Please wait." });
    win.count++;
    next();
  };
}

/* ─── In-Memory Cache ────────────────────────────────────────────────────── */
const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;
function cacheGet(k) { const e = cache.get(k); if (!e || Date.now() > e.expiry) { cache.delete(k); return null; } return e.data; }
function cacheSet(k, d) { cache.set(k, { data: d, expiry: Date.now() + CACHE_TTL_MS }); }

/* ─── Input Helpers ──────────────────────────────────────────────────────── */
function isAccount(s) { return typeof s === "string" && /^G[A-Z2-7]{55}$/.test(s.trim()); }
function parseAsset(s) {
  if (typeof s !== "string") return null;
  const t = s.trim(), idx = t.indexOf(":");
  if (idx === -1) return null;
  const code = t.slice(0, idx).trim().toUpperCase(), issuer = t.slice(idx + 1).trim().toUpperCase();
  if (!code || !issuer || !/^[A-Za-z0-9]{1,12}$/.test(code) || !isAccount(issuer)) return null;
  return { code, issuer, raw: `${code}:${issuer}` };
}
function normalizeQuery(raw) {
  if (typeof raw !== "string") return "";
  let q = raw.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  if (q.includes(":")) { const [c, ...r] = q.split(":"); q = `${c.toUpperCase()}:${r.join(":")}`; }
  return q;
}

/* ─── Fetch Helpers ──────────────────────────────────────────────────────── */
async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }
  return res.json();
}

/* ─── Full Scan (shared logic) ───────────────────────────────────────────── */
async function runScan(query, { signal, prevScore = null } = {}) {
  const asset   = parseAsset(query);
  const isAsset = Boolean(asset);
  const accountId = isAsset ? asset.issuer : query;
  let address   = query;
  let assetSupply = null;

  if (isAsset) {
    address = asset.raw;
    const assets = await fetchJson(
      `${HORIZON_URL}/assets?asset_code=${encodeURIComponent(asset.code)}&asset_issuer=${encodeURIComponent(asset.issuer)}&limit=1`,
      { signal }
    );
    const record = assets?._embedded?.records?.[0];
    if (record?.amount != null) { const p = Number(record.amount); assetSupply = Number.isFinite(p) ? p : null; }
  }

  const account = await fetchJson(`${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}`, { signal });
  const { verified: domainVerified, homeDomain: normalizedDomain, accountListed } =
    await verifyHomeDomain(account?.home_domain || null, accountId);

  const balances       = Array.isArray(account?.balances) ? account.balances : [];
  const trustlinesCount = balances.filter((b) => b?.asset_type && b.asset_type !== "native").length;
  const { qualityScore: trustlineQuality, flags: trustlineFlags } = analyzeTrustlines(balances);

  const accFlags = account?.flags || {};
  const flags = [];
  if (accFlags?.auth_required)  flags.push("auth_required");
  if (accFlags?.auth_revocable) flags.push("auth_revocable");
  if (accFlags?.auth_immutable) flags.push("auth_immutable");
  if (isAsset && account?.clawback_enabled) flags.push("clawback_enabled");

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const txRecent = await fetchJson(
    `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=desc&limit=200`,
    { signal }
  );
  const recentRecords = Array.isArray(txRecent?._embedded?.records) ? txRecent._embedded.records : [];
  const txRecentCount = recentRecords.filter((t) => {
    const c = Date.parse(t?.created_at || "");
    return Number.isFinite(c) && c >= thirtyDaysAgo;
  }).length;

  const { pattern: txPattern, flags: txFlags, velocity } = analyzeTransactionPatterns(recentRecords);

  const txOldest = await fetchJson(
    `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&limit=1`,
    { signal }
  );
  const oldest   = txOldest?._embedded?.records?.[0];
  const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
  const ageDays  = Number.isFinite(oldestAt) ? Math.max(0, Math.floor((now - oldestAt) / 86_400_000)) : null;

  const riskResult = computeRisk({
    ageDays, txRecentCount, trustlinesCount, domainVerified,
    accountListed: accountListed ?? false, flags, isAsset, assetSupply,
    txPattern, trustlineFlags, trustlineQuality, velocity, prevScore,
  });

  const confidence = computeConfidence({ ageDays, txRecentCount, domainVerified, assetSupply, isAsset });

  // ── Counterparties ─────────────────────────────────────────────────────────
  let counterparties = null;
  try {
    const opsPayload = await fetchJson(
      `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/operations?order=desc&limit=20`,
      { signal }
    );
    const ops = Array.isArray(opsPayload?._embedded?.records) ? opsPayload._embedded.records : [];
    const counterIds = new Set();
    for (const op of ops) {
      if (op.to && op.to !== accountId)         counterIds.add(op.to);
      if (op.from && op.from !== accountId)     counterIds.add(op.from);
      if (op.account && op.account !== accountId) counterIds.add(op.account);
    }
    const total = ops.length;
    const unique = counterIds.size;
    let knownVerified = 0;
    await Promise.all([...counterIds].slice(0, 5).map(async (id) => {
      try {
        const acc = await fetchJson(`${HORIZON_URL}/accounts/${encodeURIComponent(id)}`, { signal });
        if (acc?.home_domain) knownVerified++;
      } catch {}
    }));
    counterparties = { total, unique, knownVerified };
  } catch {}

  const breakdown = [
    { key: "age",        title: "Account Age",          value: ageDays == null ? "Unknown" : `${ageDays} days`,                              status: ageDays == null ? "Unknown" : ageDays < 14 ? "New" : ageDays < 90 ? "Growing" : "Established", tone: ageDays == null ? "slate" : ageDays < 14 ? "rose" : ageDays < 90 ? "amber" : "emerald", flag: ageDays != null && ageDays < 14 ? "new_account" : null },
    { key: "tx",         title: "Transactions (30d)",   value: txRecentCount?.toLocaleString() ?? "Unknown",                                  status: txRecentCount == null ? "Unknown" : txRecentCount < 5 ? "Very low" : txRecentCount < 25 ? "Low" : "Normal", tone: txRecentCount == null ? "slate" : txRecentCount < 5 ? "rose" : txRecentCount < 25 ? "amber" : "emerald", flag: txPattern !== "normal" ? txPattern : null },
    { key: "trustlines", title: "Trustlines",            value: trustlinesCount == null ? "Unknown" : String(trustlinesCount),                status: trustlinesCount == null ? "Unknown" : trustlinesCount === 0 ? "None" : trustlinesCount < 10 ? "Typical" : "Broad", tone: trustlinesCount == null ? "slate" : trustlinesCount === 0 ? "amber" : trustlineQuality < 70 ? "amber" : "emerald", flag: trustlineFlags.length > 0 ? "lookalike" : null },
    { key: "domain",     title: "Domain Status",         value: normalizedDomain || "—",                                                       status: domainVerified ? (accountListed ? "Verified + Listed" : "Verified") : "Unverified", tone: domainVerified ? "emerald" : "rose", flag: !domainVerified ? "no_domain" : null },
    { key: "supply",     title: "Asset Supply",          value: isAsset ? (assetSupply?.toLocaleString() ?? "Unknown") : "—",                 status: !isAsset ? "N/A" : assetSupply == null ? "Unknown" : assetSupply > 600_000_000 ? "Elevated" : "Normal", tone: !isAsset ? "slate" : assetSupply == null ? "slate" : assetSupply > 600_000_000 ? "amber" : "emerald", flag: isAsset && assetSupply > 600_000_000 ? "high_supply" : null },
    { key: "flags",      title: "Flags",                 value: String(flags.length),                                                          status: flags.length ? "Present" : "None", tone: flags.length ? "amber" : "emerald", flag: flags.includes("clawback_enabled") ? "clawback" : flags.length > 0 ? "flagged" : null },
  ];

  return {
    input: query, isAsset, address,
    ...riskResult,
    confidence,
    breakdown,
    counterparties,
    raw: { horizon: HORIZON_URL, accountId },
  };
}

/* ─── WebSocket: Live Stream ─────────────────────────────────────────────── */
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
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "\"hello\"" || payload === "bye") continue;
          let tx;
          try { tx = JSON.parse(payload); } catch { continue; }
          if (!tx?.id) continue;

          resetKillTimer();
          try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 12_000);
            const updated = await runScan(accountId, { signal: controller.signal, prevScore: lastScore });
            clearTimeout(t);
            lastScore = updated.score;
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "update", newTx: tx, ...updated }));
            }
          } catch (e) { console.error("[ws rescan]", e?.message); }
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.error("[horizon stream]", e?.message);
    }
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "subscribe" && msg.accountId) {
        const id = String(msg.accountId).trim().toUpperCase();
        if (isAccount(id)) startStream(id);
      } else if (msg.type === "unsubscribe") {
        cleanup();
      }
    } catch {}
  });

  ws.on("close", cleanup);
  ws.on("error", cleanup);
});

/* ─── POST /api/scan ─────────────────────────────────────────────────────── */
app.post("/api/scan", rateLimitMiddleware(30), async (req, res) => {
  try {
    const query = normalizeQuery(req.body?.query ?? "");
    if (!query) return res.status(400).json({ error: "Missing query" });

    const asset   = parseAsset(query);
    const isAsset = Boolean(asset);
    if (!isAsset && !isAccount(query))
      return res.status(400).json({ error: "Invalid input. Use a Stellar account (G...) or CODE:ISSUER." });

    const cacheKey = isAsset ? `asset:${asset.code}:${asset.issuer}` : `account:${query}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 14_000);
    try {
      const result = await runScan(query, { signal: controller.signal });
      cacheSet(cacheKey, result);
      return res.json(result);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[scan error]", err?.message);
    const status = err?.status === 404 ? 404 : 500;
    const message = err?.status === 404
      ? "Not found on Stellar network."
      : err?.name === "AbortError"
        ? "Request timed out. Please try again."
        : "Scan failed. Please try again.";
    return res.status(status).json({ error: message });
  }
});

/* ─── GET /api/health ────────────────────────────────────────────────────── */
app.get("/api/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Sentio server running on http://localhost:${PORT}`));
