/**
 * requireAdminToken — middleware that checks the Authorization header.
 *
 * Set SENTIO_ADMIN_TOKEN in your .env to a long random secret.
 * The frontend must send:  Authorization: Bearer <token>
 *
 * Generate a good token with:  openssl rand -hex 32
 */
export function requireAdminToken(req, res, next) {
  const ADMIN_TOKEN = process.env.SENTIO_ADMIN_TOKEN;

  if (!ADMIN_TOKEN) {
    // If no token is configured, block the route entirely in production
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Admin endpoint not configured." });
    }
    // In development, warn loudly but allow through so you can test locally
    console.warn("[auth] SENTIO_ADMIN_TOKEN is not set — admin routes are unprotected!");
    return next();
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
}
