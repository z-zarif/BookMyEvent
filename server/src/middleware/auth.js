import jwt from 'jsonwebtoken';
import pool from '../db/db.js';



export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const blacklisted = await pool.query(
      'SELECT 1 FROM TOKEN_BLACKLIST WHERE TOKEN = $1',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been logged out' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.token = token; // logout route needs the raw token
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireOrganizer = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ORGANIZER_ID FROM ORGANIZERS WHERE ORGANIZER_ID = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Organizer access required" });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authorization check failed" });
  }
};

// Admin access. The USERS table has no admin column, so rather than changing
// the schema we keep a comma-separated allowlist of admin emails in .env:
//
//   ADMIN_EMAILS=admin@eventia.test,someone@else.com
//
// The user's email is looked up fresh from the DB each time rather than
// trusted from the JWT, so editing .env takes effect without re-issuing tokens.
export const requireAdmin = async (req, res, next) => {
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return res
      .status(503)
      .json({ error: "No admins configured. Set ADMIN_EMAILS in .env" });
  }

  try {
    const result = await pool.query(
      `SELECT EMAIL FROM USERS WHERE USER_ID = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const email = result.rows[0].email.trim().toLowerCase();

    if (!allowlist.includes(email)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authorization check failed" });
  }
};
