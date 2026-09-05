import jwt from 'jsonwebtoken';
import pool from '../db/db.js';



export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. check authHeader exists and starts with "Bearer "
  //    if not → 401
    if (!authHeader ||!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
        error: "Authorization token required",
    });
    }

  // 2. extract the token string (strip "Bearer ")
  const token=authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token,process.env.JWT_SECRET);
    req.user= decoded;
    next();
    // 3. try jwt.verify(token, process.env.JWT_SECRET)
    //    - on success: attach decoded payload to req.user, call next()
    //    - on failure (catch block): 401
 } catch (err) {
  return res.status(401).json({ error: "Invalid or Expired Token" });
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