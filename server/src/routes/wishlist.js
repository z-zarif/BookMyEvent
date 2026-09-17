import express from "express";
import pool from "../db/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET /wishlist
// Lists the events the logged-in user has saved.
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         E.EVENT_ID,
         E.TITLE,
         E.EVENT_DATE_TIME,
         E.VENUE,
         E.STATUS,
         W.ADDED_AT
       FROM WISHLIST W
       JOIN EVENTS E ON E.EVENT_ID = W.EVENT_ID
       WHERE W.USER_ID = $1
       ORDER BY W.ADDED_AT DESC`,
      [req.user.user_id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch wishlist" });
  }
});

// POST /wishlist
// Saves an event. WISHLIST's primary key is (USER_ID, EVENT_ID), so
// ON CONFLICT DO NOTHING makes saving the same event twice harmless.
router.post("/", verifyToken, async (req, res) => {
  const { eventId } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: "eventId is required" });
  }

  try {
    await pool.query(
      `INSERT INTO WISHLIST (USER_ID, EVENT_ID)
       VALUES ($1, $2)
       ON CONFLICT (USER_ID, EVENT_ID) DO NOTHING`,
      [req.user.user_id, eventId],
    );

    res.status(201).json({ added: true });
  } catch (err) {
    console.error(err);
    if (err.code === "23503") {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(500).json({ error: "Could not add to wishlist" });
  }
});

// DELETE /wishlist/:eventId
router.delete("/:eventId", verifyToken, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM WISHLIST WHERE USER_ID = $1 AND EVENT_ID = $2`,
      [req.user.user_id, req.params.eventId],
    );

    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not remove from wishlist" });
  }
});

export default router;
