import express from "express";
import pool from "../db/db.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// Every route in this file requires a logged-in admin.
router.use(requireAdminAuth);

const reportQueries = {
  revenue: `
    WITH booking_revenue AS (
      SELECT BOOKING_ID, SUM(AMOUNT) AS booking_revenue
      FROM PAYMENTS
      GROUP BY BOOKING_ID
    ),
    event_revenue AS (
      SELECT B.EVENT_ID, SUM(BR.booking_revenue) AS revenue
      FROM BOOKINGS B
      JOIN booking_revenue BR ON BR.BOOKING_ID = B.BOOKING_ID
      GROUP BY B.EVENT_ID
    ),
    event_ticket_sales AS (
      SELECT B.EVENT_ID, COUNT(T.TICKET_ID)::int AS tickets_sold
      FROM BOOKINGS B
      LEFT JOIN TICKETS T ON T.BOOKING_ID = B.BOOKING_ID
      GROUP BY B.EVENT_ID
    )
    SELECT E.ORGANIZER_ID, E.EVENT_ID, E.TITLE, E.EVENT_DATE_TIME,
           E.STATUS AS event_status,
           COALESCE(ER.revenue, 0)::numeric(12, 2) AS total_revenue,
           COALESCE(ETS.tickets_sold, 0) AS tickets_sold
    FROM EVENTS E
    LEFT JOIN event_revenue ER ON ER.EVENT_ID = E.EVENT_ID
    LEFT JOIN event_ticket_sales ETS ON ETS.EVENT_ID = E.EVENT_ID
    ORDER BY total_revenue DESC, E.EVENT_DATE_TIME DESC
  `,
  occupancy: `
    WITH event_capacity AS (
      SELECT EVENT_ID, SUM(QUANTITY_AVAILABLE)::int AS remaining_capacity
      FROM TICKET_TYPE
      GROUP BY EVENT_ID
    ),
    event_ticket_sales AS (
      SELECT TT.EVENT_ID, COUNT(T.TICKET_ID)::int AS tickets_sold
      FROM TICKET_TYPE TT
      LEFT JOIN TICKETS T ON T.TICKET_TYPE_ID = TT.TYPE_ID
      GROUP BY TT.EVENT_ID
    )
    SELECT E.EVENT_ID, E.ORGANIZER_ID, E.TITLE,
           COALESCE(EC.remaining_capacity, 0) + COALESCE(ETS.tickets_sold, 0)
             AS total_capacity,
           COALESCE(ETS.tickets_sold, 0) AS tickets_sold,
           ROUND(
             100.0 * COALESCE(ETS.tickets_sold, 0)
             / NULLIF(COALESCE(EC.remaining_capacity, 0)
               + COALESCE(ETS.tickets_sold, 0), 0), 2
           ) AS fill_percentage
    FROM EVENTS E
    LEFT JOIN event_capacity EC ON EC.EVENT_ID = E.EVENT_ID
    LEFT JOIN event_ticket_sales ETS ON ETS.EVENT_ID = E.EVENT_ID
    ORDER BY fill_percentage DESC NULLS LAST, tickets_sold DESC, E.TITLE
  `,
  customers: `
    WITH booking_spend AS (
      SELECT BOOKING_ID, SUM(AMOUNT) AS booking_spend
      FROM PAYMENTS
      GROUP BY BOOKING_ID
    )
    SELECT U.USER_ID, U.USER_NAME, U.EMAIL,
           SUM(BS.booking_spend)::numeric(12, 2) AS total_spend,
           COUNT(DISTINCT B.BOOKING_ID)::int AS paid_booking_count
    FROM USERS U
    JOIN BOOKINGS B ON B.USER_ID = U.USER_ID
    JOIN booking_spend BS ON BS.BOOKING_ID = B.BOOKING_ID
    GROUP BY U.USER_ID, U.USER_NAME, U.EMAIL
    ORDER BY total_spend DESC, paid_booking_count DESC, U.USER_NAME
  `,
  promos: `
    SELECT PC.PROMO_ID, PC.CODE, PC.STATUS, PC.DISCOUNT_TYPE,
           PC.DISCOUNT_VALUE,
           COUNT(PR.REDEMPTION_ID)::int AS redemption_count,
           COALESCE(SUM(PR.DISCOUNT_APPLIED), 0)::numeric(12, 2)
             AS total_discount_given
    FROM PROMO_CODES PC
    LEFT JOIN PROMO_REDEMPTIONS PR ON PR.PROMO_ID = PC.PROMO_ID
    GROUP BY PC.PROMO_ID, PC.CODE, PC.STATUS, PC.DISCOUNT_TYPE,
             PC.DISCOUNT_VALUE
    ORDER BY total_discount_given DESC, redemption_count DESC, PC.CODE
  `,
  wishlists: `
    SELECT E.EVENT_ID, E.ORGANIZER_ID, E.TITLE, E.EVENT_DATE_TIME,
           E.STATUS AS event_status, COUNT(W.USER_ID)::int AS wishlist_count
    FROM EVENTS E
    LEFT JOIN WISHLIST W ON W.EVENT_ID = E.EVENT_ID
    GROUP BY E.EVENT_ID, E.ORGANIZER_ID, E.TITLE, E.EVENT_DATE_TIME, E.STATUS
    ORDER BY wishlist_count DESC, E.EVENT_DATE_TIME ASC, E.TITLE
  `,
};

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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE ADD_MONEY_REQUESTS
       SET STATUS = 'approved'
       WHERE REQUEST_ID = $1 AND STATUS = 'pending'
       RETURNING REQUEST_ID, STATUS, PROCESSED_AT`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      const existing = await client.query(
        `SELECT STATUS FROM ADD_MONEY_REQUESTS WHERE REQUEST_ID = $1`,
        [req.params.id],
      );
      await client.query("ROLLBACK");
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }
      return res
        .status(409)
        .json({ error: `Request is already ${existing.rows[0].status}` });
    }

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "Could not approve request" });
  } finally {
    client.release();
  }
});

// POST /admin/add-money-requests/:id/reject
router.post("/add-money-requests/:id/reject", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE ADD_MONEY_REQUESTS
       SET STATUS = 'rejected', PROCESSED_AT = CURRENT_TIMESTAMP
       WHERE REQUEST_ID = $1 AND STATUS = 'pending'
       RETURNING REQUEST_ID, STATUS, PROCESSED_AT`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      const existing = await client.query(
        `SELECT STATUS FROM ADD_MONEY_REQUESTS WHERE REQUEST_ID = $1`,
        [req.params.id],
      );
      await client.query("ROLLBACK");
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }
      return res
        .status(409)
        .json({ error: `Request is already ${existing.rows[0].status}` });
    }

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not reject request" });
  } finally {
    client.release();
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

// GET /admin/reports
// All report data is protected by requireAdminAuth above.
router.get("/reports", async (req, res) => {
  try {
    const entries = await Promise.all(
      Object.entries(reportQueries).map(async ([name, query]) => [
        name,
        (await pool.query(query)).rows,
      ]),
    );

    res.json(Object.fromEntries(entries));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load admin reports" });
  }
});

export default router;
