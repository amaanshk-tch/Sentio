// Each named bucket maintains its own per-IP window map, isolating
// traffic across tiers so scan, registry-read, and admin-write
// quotas are tracked independently.
const buckets = new Map(); // bucketName -> Map<ip, { count, resetAt }>

function getBucket(name) {
  if (!buckets.has(name)) buckets.set(name, new Map());
  return buckets.get(name);
}

// Sweep expired windows across all buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [, windows] of buckets) {
    for (const [ip, win] of windows) {
      if (now > win.resetAt) windows.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Named rate-limit middleware.
 * @param {string} bucket   - Unique name for this tier (e.g. "scan", "registry-read", "admin-write")
 * @param {number} maxPerMinute
 */
export function rateLimitMiddleware(bucket, maxPerMinute) {
  return (req, res, next) => {
    const windows = getBucket(bucket);
    const ip  = req.ip || "unknown";
    const now = Date.now();
    const win = windows.get(ip);

    if (!win || now > win.resetAt) {
      windows.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (win.count >= maxPerMinute) {
      res.set("Retry-After", Math.ceil((win.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many requests. Please wait." });
    }
    win.count++;
    next();
  };
}
