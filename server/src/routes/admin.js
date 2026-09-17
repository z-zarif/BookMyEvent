import express from "express";
import pool from "../db/db.js";
import { verifyToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Every route in this file requires a logged-in admin.
router.use(verifyToken, requireAdmin);

// GET /admin/me
// Lets the frontend check "am I an admin?" without guessing.
router.get("/me", (req, res) => {
  res.json({ isAdmin: true });
});

// GET /admin/add-money-requests?status=pending
// Lists money requests, optionally filtered by status.
router.get("/add-money-requests", async (req, res) => {
  const { status } = req.query;

  try {
    const params = [];
    let whereClause = "";

    if (status) {
      params.push(status);
      whereClause = `WHERE R.STATUS = $1`;
    }

    const result = await pool.query(
      `SELECT
         R.REQUEST_ID,
         R.AMOUNT,
         R.STATUS,
         R.REQUESTED_AT,
         R.PROCESSED_AT,
         U.USER_ID,
         U.USER_NAME,
         U.EMAIL
       FROM ADD_MONEY_REQUESTS R
       JOIN USERS U ON U.USER_ID = R.USER_ID
       ${whereClause}
       ORDER BY R.REQUESTED_AT DESC
       LIMIT 200`,
      params,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch add-money requests" });
  }
});

// POST /admin/add-money-requests/:id/approve
// Flipping STATUS to 'approved' fires trg_add_money_request_approved, which
// creates the deposit in WALLET_TRANSACTIONS and updates the wallet balance.
// We deliberately do NOT touch WALLETS here - the trigger owns that.
router.post("/add-money-requests/:id/approve", async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT STATUS FROM ADD_MONEY_REQUESTS WHERE REQUEST_ID = $1`,
      [req.params.id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.rows[0].status !== "pending") {
      return res
        .status(409)
        .json({ error: `Request is already ${existing.rows[0].status}` });
    }

    const result = await pool.query(
      `UPDATE ADD_MONEY_REQUESTS
       SET STATUS = 'approved'
       WHERE REQUEST_ID = $1
       RETURNING REQUEST_ID, STATUS, PROCESSED_AT`,
      [req.params.id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not approve request" });
  }
});

// POST /admin/add-money-requests/:id/reject
router.post("/add-money-requests/:id/reject", async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT STATUS FROM ADD_MONEY_REQUESTS WHERE REQUEST_ID = $1`,
      [req.params.id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.rows[0].status !== "pending") {
      return res
        .status(409)
        .json({ error: `Request is already ${existing.rows[0].status}` });
    }

    const result = await pool.query(
      `UPDATE ADD_MONEY_REQUESTS
       SET STATUS = 'rejected', PROCESSED_AT = CURRENT_TIMESTAMP
       WHERE REQUEST_ID = $1
       RETURNING REQUEST_ID, STATUS, PROCESSED_AT`,
      [req.params.id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reject request" });
  }
});

// GET /admin/wallets
// Every user's wallet balance - the money overview page.
router.get("/wallets", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         W.WALLET_ID,
         W.BALANCE,
         W.LAST_USED,
         U.USER_ID,
         U.USER_NAME,
         U.EMAIL
       FROM WALLETS W
       JOIN USERS U ON U.USER_ID = W.USER_ID
       ORDER BY W.BALANCE DESC
       LIMIT 200`,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch wallets" });
  }
});

// GET /admin/transactions
// Recent wallet transactions across all users.
router.get("/transactions", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         T.TRANSACTION_ID,
         T.TYPE,
         T.AMOUNT,
         T.REASON,
         T.REFERENCE_ID,
         T.BALANCE_AFTER,
         T.HAPPENED_AT,
         U.USER_NAME,
         U.EMAIL
       FROM WALLET_TRANSACTIONS T
       JOIN WALLETS W ON W.WALLET_ID = T.WALLET_ID
       JOIN USERS U ON U.USER_ID = W.USER_ID
       ORDER BY T.HAPPENED_AT DESC
       LIMIT 200`,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch transactions" });
  }
});

// GET /admin/audit-log
// TICKET_AUDIT_LOG, written automatically by trg_ticket_type_audit whenever
// a ticket type's quantity or status changes. Good for demoing that the
// database triggers are doing real work.
router.get("/audit-log", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         L.LOG_ID,
         L.TYPE_ID,
         L.OLD_QUANTITY,
         L.NEW_QUANTITY,
         L.OLD_STATUS,
         L.NEW_STATUS,
         L.CHANGED_AT,
         TT.CATEGORY,
         E.TITLE AS EVENT_TITLE
       FROM TICKET_AUDIT_LOG L
       JOIN TICKET_TYPE TT ON TT.TYPE_ID = L.TYPE_ID
       JOIN EVENTS E ON E.EVENT_ID = TT.EVENT_ID
       ORDER BY L.CHANGED_AT DESC
       LIMIT 200`,
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch audit log" });
  }
});

// GET /admin/stats
// Headline numbers for the admin dashboard.
router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM USERS) AS total_users,
         (SELECT COUNT(*) FROM EVENTS) AS total_events,
         (SELECT COUNT(*) FROM BOOKINGS WHERE BK_STATUS = 'confirmed') AS confirmed_bookings,
         (SELECT COUNT(*) FROM ADD_MONEY_REQUESTS WHERE STATUS = 'pending') AS pending_requests,
         (SELECT COALESCE(SUM(BALANCE), 0) FROM WALLETS) AS total_wallet_balance`,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch stats" });
  }
});

export default router;
