import express from "express";
import cors from "cors";
import {
  verifyHomeDomain,
  analyzeTransactionPatterns,
  analyzeTrustlines,
  computeConfidence,
  computeRisk,
} from "./riskEngine.js";

const app = express();
app.use(cors());
app.use(express.json());

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";

/* ─── Rate Limiting ──────────────────────────────────────────────────────── */
const rateWindows = new Map();

function rateLimitMiddleware(maxPerMinute = 30) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const window = rateWindows.get(ip);
    if (!window || now > window.resetAt) {
      rateWindows.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (window.count >= maxPerMinute) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before scanning again." });
    }
    window.count++;
    next();
  };
}

/* ─── In-Memory Cache ────────────────────────────────────────────────────── */
const cache = new Map(); // key -> { data, expiry }
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/* ─── Input Parsing & Normalization ──────────────────────────────────────── */
function isLikelyStellarAccount(s) {
  return typeof s === "string" && /^G[A-Z2-7]{55}$/.test(s.trim());
}

function parseAsset(s) {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) return null;
  const code = trimmed.slice(0, idx).trim().toUpperCase();
  const issuer = trimmed.slice(idx + 1).trim().toUpperCase();
  if (!code || !issuer) return null;
  if (!/^[A-Za-z0-9]{1,12}$/.test(code)) return null;
  if (!isLikelyStellarAccount(issuer)) return null;
  return { code, issuer, raw: `${code}:${issuer}` };
}

function normalizeQuery(raw) {
  if (typeof raw !== "string") return "";
  // Collapse whitespace, strip invisible chars
  let q = raw.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  // If it looks like an asset (contains :) uppercase the code part
  if (q.includes(":")) {
    const [code, ...rest] = q.split(":");
    q = `${code.toUpperCase()}:${rest.join(":")}`;
  }
  return q;
}

/* ─── Fetch Helpers ──────────────────────────────────────────────────────── */
async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

/* ─── /api/scan ──────────────────────────────────────────────────────────── */
app.post("/api/scan", rateLimitMiddleware(30), async (req, res) => {
  try {
    const body = req.body || {};
    const raw = typeof body?.query === "string" ? body.query : "";
    const query = normalizeQuery(raw);
    if (!query) return res.status(400).json({ error: "Missing query" });

    const asset = parseAsset(query);
    const isAsset = Boolean(asset);

    if (!isAsset && !isLikelyStellarAccount(query)) {
      return res.status(400).json({
        error: "Invalid input. Accepted formats: Stellar account (G...) or asset (CODE:ISSUER).",
      });
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = isAsset ? `asset:${asset.code}:${asset.issuer}` : `account:${query}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // ── Fetch ────────────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14_000);
    const signal = controller.signal;

    try {
      let address = query;
      let accountId = query;
      let assetSupply = null;

      if (isAsset) {
        address = asset.raw;
        accountId = asset.issuer;

        const assetsUrl = `${HORIZON_URL}/assets?asset_code=${encodeURIComponent(asset.code)}&asset_issuer=${encodeURIComponent(asset.issuer)}&limit=1`;
        const assets = await fetchJson(assetsUrl, { signal });
        const record = assets?._embedded?.records?.[0];
        if (record?.amount != null) {
          const parsed = Number(record.amount);
          assetSupply = Number.isFinite(parsed) ? parsed : null;
        }
      }

      const accountUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}`;
      const account = await fetchJson(accountUrl, { signal });

      // ── Domain + TOML ──────────────────────────────────────────────────────
      const homeDomain = account?.home_domain || null;
      const { verified: domainVerified, homeDomain: normalizedDomain, accountListed } =
        await verifyHomeDomain(homeDomain, accountId);

      // ── Balances / trustlines ──────────────────────────────────────────────
      const balances = Array.isArray(account?.balances) ? account.balances : [];
      const trustlinesCount = balances.filter((b) => b?.asset_type && b.asset_type !== "native").length;
      const { qualityScore: trustlineQuality, flags: trustlineFlags } = analyzeTrustlines(balances);

      // ── Flags ──────────────────────────────────────────────────────────────
      const flags = [];
      const accFlags = account?.flags || {};
      if (accFlags?.auth_required)  flags.push("auth_required");
      if (accFlags?.auth_revocable) flags.push("auth_revocable");
      if (accFlags?.auth_immutable) flags.push("auth_immutable");
      if (isAsset && account?.clawback_enabled) flags.push("clawback_enabled");

      // ── Transactions ───────────────────────────────────────────────────────
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const txRecentUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=desc&limit=200`;
      const txRecent = await fetchJson(txRecentUrl, { signal });
      const recentRecords = Array.isArray(txRecent?._embedded?.records) ? txRecent._embedded.records : [];
      const txRecentCount = recentRecords.filter((t) => {
        const created = Date.parse(t?.created_at || "");
        return Number.isFinite(created) && created >= thirtyDaysAgo;
      }).length;

      const { pattern: txPattern, flags: txFlags } = analyzeTransactionPatterns(recentRecords);

      const txOldestUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&limit=1`;
      const txOldest = await fetchJson(txOldestUrl, { signal });
      const oldest = txOldest?._embedded?.records?.[0];
      const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
      const ageDays = Number.isFinite(oldestAt)
        ? Math.max(0, Math.floor((now - oldestAt) / (24 * 60 * 60 * 1000)))
        : null;

      // ── Risk computation ───────────────────────────────────────────────────
      const { score, risk, color, reasons, riskFactors, insight, action } = computeRisk({
        ageDays,
        txRecentCount,
        trustlinesCount,
        domainVerified,
        accountListed: accountListed ?? false,
        flags,
        isAsset,
        assetSupply,
        txPattern,
        trustlineFlags,
        trustlineQuality,
      });

      const confidence = computeConfidence({ ageDays, txRecentCount, domainVerified, assetSupply, isAsset });

      // ── Breakdown grid ─────────────────────────────────────────────────────
      const breakdown = [
        {
          key: "age",
          title: "Account Age",
          value: ageDays == null ? "Unknown" : `${ageDays} days`,
          status: ageDays == null ? "Unknown" : ageDays < 14 ? "New" : ageDays < 90 ? "Growing" : "Established",
          tone: ageDays == null ? "slate" : ageDays < 14 ? "rose" : ageDays < 90 ? "amber" : "emerald",
        },
        {
          key: "tx",
          title: "Transactions (30d)",
          value: txRecentCount == null ? "Unknown" : txRecentCount.toLocaleString(),
          status: txRecentCount == null ? "Unknown" : txRecentCount < 5 ? "Very low" : txRecentCount < 25 ? "Low" : "Normal",
          tone: txRecentCount == null ? "slate" : txRecentCount < 5 ? "rose" : txRecentCount < 25 ? "amber" : "emerald",
          flag: txPattern !== "normal" ? txPattern : null,
        },
        {
          key: "trustlines",
          title: "Trustlines",
          value: trustlinesCount == null ? "Unknown" : String(trustlinesCount),
          status: trustlinesCount == null ? "Unknown" : trustlinesCount === 0 ? "None" : trustlinesCount < 10 ? "Typical" : "Broad",
          tone: trustlinesCount == null ? "slate" : trustlinesCount === 0 ? "amber" :
            (trustlineQuality < 70 ? "amber" : "emerald"),
          flag: trustlineFlags.length > 0 ? "lookalike" : null,
        },
        {
          key: "domain",
          title: "Domain Status",
          value: normalizedDomain ? normalizedDomain : "—",
          status: domainVerified ? (accountListed ? "Verified + Listed" : "Verified") : "Unverified",
          tone: domainVerified ? "emerald" : "rose",
          flag: !domainVerified ? "no_domain" : null,
        },
        {
          key: "supply",
          title: "Asset Supply",
          value: isAsset ? (assetSupply == null ? "Unknown" : assetSupply.toLocaleString()) : "—",
          status: !isAsset ? "N/A" : assetSupply == null ? "Unknown" : assetSupply > 600_000_000 ? "Elevated" : "Normal",
          tone: !isAsset ? "slate" : assetSupply == null ? "slate" : assetSupply > 600_000_000 ? "amber" : "emerald",
          flag: isAsset && assetSupply > 600_000_000 ? "high_supply" : null,
        },
        {
          key: "flags",
          title: "Flags",
          value: String(flags.length),
          status: flags.length ? "Present" : "None",
          tone: flags.length ? "amber" : "emerald",
          flag: flags.includes("clawback_enabled") ? "clawback" : flags.length > 0 ? "flagged" : null,
        },
      ];

      const result = {
        input: query,
        isAsset,
        address,
        score,
        risk,
        color,
        reasons,
        riskFactors,
        breakdown,
        insight,
        action,
        confidence,
        raw: { horizon: HORIZON_URL, accountId },
      };

      cacheSet(cacheKey, result);
      return res.json(result);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[scan error]", err?.message || err);
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    const message =
      status === 404
        ? "Not found on the Stellar network. Check the address or issuer."
        : err?.name === "AbortError"
          ? "Request timed out. Please try again."
          : "Scan failed. Please try again.";
    return res.status(status === 404 ? 404 : 500).json({ error: message });
  }
});

/* ─── Health endpoint ────────────────────────────────────────────────────── */
app.get("/api/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sentio API server running on http://localhost:${PORT}`);
});
