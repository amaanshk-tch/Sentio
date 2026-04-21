import { rateLimit } from "express-rate-limit";

const LIMITS = {
  "scan":           { max: 30,  windowMs: 60_000 },
  "registry-read":  { max: 60,  windowMs: 60_000 },
  "admin-write":    { max: 5,   windowMs: 60_000 },
};

const limiters = new Map();

export function rateLimitMiddleware(bucket, maxPerMinute) {
  if (limiters.has(bucket)) return limiters.get(bucket);

  const config = LIMITS[bucket] || { max: maxPerMinute, windowMs: 60_000 };
  const limiter = rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,  // RateLimit-* headers (RFC 6585)
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: "Too many requests. Please wait." });
    },
  });

  limiters.set(bucket, limiter);
  return limiter;
}
