const rateWindows = new Map();

// Periodically clean up expired windows to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, win] of rateWindows) {
    if (now > win.resetAt) rateWindows.delete(ip);
  }
}, 5 * 60 * 1000);

export function rateLimitMiddleware(maxPerMinute = 30) {
  return (req, res, next) => {
    // req.ip is reliable because we set app.set("trust proxy", 1) in server/index.js
    const ip  = req.ip || "unknown";
    const now = Date.now();
    const win = rateWindows.get(ip);

    if (!win || now > win.resetAt) {
      rateWindows.set(ip, { count: 1, resetAt: now + 60_000 });
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
