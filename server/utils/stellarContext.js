import { HORIZON_URL } from "../config.js";
export { HORIZON_URL };

export async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }
  return res.json();
}

export function isAccount(s) { 
  return typeof s === "string" && /^G[A-Z2-7]{55}$/.test(s.trim()); 
}

export function parseAsset(s) {
  if (typeof s !== "string") return null;
  const t = s.trim(), idx = t.indexOf(":");
  if (idx === -1) return null;
  const code = t.slice(0, idx).trim().toUpperCase(), issuer = t.slice(idx + 1).trim().toUpperCase();
  if (!code || !issuer || !/^[A-Za-z0-9]{1,12}$/.test(code) || !isAccount(issuer)) return null;
  return { code, issuer, raw: `${code}:${issuer}` };
}

export function normalizeQuery(raw) {
  if (typeof raw !== "string") return "";
  let q = raw.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  if (q.includes(":")) { const [c, ...r] = q.split(":"); q = `${c.toUpperCase()}:${r.join(":")}`; }
  return q;
}
