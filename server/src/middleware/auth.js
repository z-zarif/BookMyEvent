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

