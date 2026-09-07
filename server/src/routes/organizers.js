import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
// Creates a new Express Router to group organizer-related routes together.

// POST /organizers/register
// Lets the currently logged-in user become an organizer.
router.post("/register", verifyToken, async (req, res) => {
  const { companyName, bio } = req.body;
  // Extracts the company name and bio from the request body.
  const userId = req.user.user_id;
  // Gets the logged-in user's ID from the decoded JWT (set by verifyToken).

  if (!companyName) {
    return res.status(400).json({ error: "companyName is required" });
  }
  // Company name is required by the ORGANIZERS table (NOT NULL), so we
  // validate it here before touching the database.

  try {
    // Check if this user is already an organizer, since ORGANIZER_ID is
    // the primary key and re-inserting would just fail with a duplicate error.
    const existing = await pool.query(
      `SELECT ORGANIZER_ID FROM ORGANIZERS WHERE ORGANIZER_ID = $1`,
      [userId],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "You are already an organizer" });
    }

    // Insert the new organizer row. ORGANIZER_ID references USERS(USER_ID)
    // directly, so we reuse the same ID instead of generating a new one.
    await pool.query(
      `INSERT INTO ORGANIZERS (ORGANIZER_ID, COMPANY_NAME, BIO)
       VALUES ($1, $2, $3)`,
      [userId, companyName, bio || null],
    );

    // Re-issue a token with role: "organizer" so the frontend can tell
    // the user has been upgraded, without needing to log in again.
    const token = jwt.sign(
      { user_id: userId, role: "organizer" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "You are now an organizer",
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not register as organizer" });
  }
});

// GET /organizers/me
// Returns the logged-in user's organizer profile, or 404 if they aren't one.
router.get("/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ORGANIZER_ID, COMPANY_NAME, BIO
       FROM ORGANIZERS
       WHERE ORGANIZER_ID = $1`,
      [req.user.user_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not an organizer" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch organizer profile" });
  }
});

// GET /organizers/my-events
// Lists events created by the logged-in organizer, for their dashboard.
router.get("/my-events", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT EVENT_ID, TITLE, EVENT_DATE_TIME, VENUE, STATUS
       FROM EVENTS
       WHERE ORGANIZER_ID = $1
       ORDER BY EVENT_DATE_TIME DESC`,
      [req.user.user_id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch your events" });
  }
});

export default router;
