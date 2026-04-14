export function requireAdminToken(req, res, next) {
  const ADMIN_TOKEN = process.env.SENTIO_ADMIN_TOKEN;

  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Admin endpoint not configured." });
    }
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
}
