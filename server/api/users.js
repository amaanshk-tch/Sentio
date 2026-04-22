import mysql from "mysql2/promise";
import { broadcastUserCount } from "../ws/stream.js";

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST,
  port:     parseInt(process.env.MYSQL_PORT),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

pool.getConnection()
  .then(conn => { console.log("[users] MySQL connected"); conn.release(); })
  .catch(err => { console.error("[users] MySQL connection failed:", err.message); process.exit(1); });

const ACCOUNT_RE = /^G[A-Z2-7]{55}$/;
const VALID_SCANNED_RE = /^[A-Z0-9]{1,12}:[A-Z2-7]{56}$|^G[A-Z2-7]{55}$|^C[A-Z2-7]{55}$/;

export async function connectUserHandler(req, res) {
  const { walletAddress, network } = req.body;

  if (!walletAddress || !ACCOUNT_RE.test(walletAddress)) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  const conn = await pool.getConnection();
  try {
    const now = new Date();
    const net = network === "mainnet" ? "mainnet" : "testnet";

    await conn.execute(`
      INSERT INTO users (walletAddress, network, connectedAt, lastSeen, scanCount)
      VALUES (?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE lastSeen = ?, network = ?
    `, [walletAddress, net, now, now, now, net]);

    const [[{ total }]] = await conn.execute(
      "SELECT COUNT(*) as total FROM users"
    );
    broadcastUserCount(total);

    return res.json({ success: true, total });
  } catch (err) {
    console.error("[connectUserHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    conn.release();
  }
}

export async function logSearchHandler(req, res) {
  const { walletAddress, scannedAddress, network } = req.body;

  if (!walletAddress || !ACCOUNT_RE.test(walletAddress)) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  if (!scannedAddress || !VALID_SCANNED_RE.test(scannedAddress)) {
    return res.status(400).json({ error: "Invalid scanned address." });
  }

  const conn = await pool.getConnection();
  try {
    const now = new Date();
    const net = network === "mainnet" ? "mainnet" : "testnet";

    await conn.execute(`
      INSERT INTO search_history (walletAddress, scannedAddress, network, searchedAt)
      VALUES (?, ?, ?, ?)
    `, [walletAddress, scannedAddress, net, now]);
    await conn.execute(`
      UPDATE users SET scanCount = scanCount + 1, lastSeen = ?
      WHERE walletAddress = ?
    `, [now, walletAddress]);

    return res.json({ success: true });
  } catch (err) {
    console.error("[logSearchHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    conn.release();
  }
}

export async function getSearchHistoryHandler(req, res) {
  const { walletAddress } = req.params;

  if (!walletAddress || !ACCOUNT_RE.test(walletAddress)) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT scannedAddress, network, searchedAt FROM search_history
       WHERE walletAddress = ? ORDER BY searchedAt DESC LIMIT 50`,
      [walletAddress]
    );
    return res.json({ history: rows });
  } catch (err) {
    console.error("[getSearchHistoryHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    conn.release();
  }
}

// GET /api/users/list — admin only
export async function listUsersHandler(req, res) {
  const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
  const limit = Math.min(200, parseInt(req.query.limit || "50", 10));
  const offset = (page - 1) * limit;

  const conn = await pool.getConnection();
  try {
    const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM users");
    const [users] = await conn.execute(
      `SELECT walletAddress, network, connectedAt, lastSeen, scanCount
       FROM users ORDER BY connectedAt DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return res.json({ total, page, limit, users });
  } catch (err) {
    console.error("[listUsersHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    conn.release();
  }
}

export async function getUserCountHandler(req, res) {
  const conn = await pool.getConnection();
  try {
    const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM users");
    return res.json({ total });
  } catch (err) {
    console.error("[getUserCountHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  } finally {
    conn.release();
  }
}