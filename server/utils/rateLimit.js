const rateWindows = new Map();

export function rateLimitMiddleware(maxPerMinute = 30) {
  return (req, res, next) => {
    const ip  = req.ip || req.connection?.remoteAddress || "unknown";
    const now = Date.now();
    const win = rateWindows.get(ip);
    if (!win || now > win.resetAt) { 
      rateWindows.set(ip, { count: 1, resetAt: now + 60_000 }); 
      return next(); 
    }
    if (win.count >= maxPerMinute) {
      return res.status(429).json({ error: "Too many requests. Please wait." });
    }
    win.count++;
    next();
  };
}
