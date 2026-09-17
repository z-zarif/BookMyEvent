import express from "express";
import pool from "../db/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET /wallet
// Returns the logged-in user's wallet balance and recent transactions.
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.user_id;

  try {
    const walletResult = await pool.query(
      `SELECT WALLET_ID, BALANCE, LAST_USED FROM WALLETS WHERE USER_ID = $1`,
      [userId],
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: "No wallet found for user" });
    }

    const wallet = walletResult.rows[0];

    const transactionsResult = await pool.query(
      `SELECT TRANSACTION_ID, TYPE, AMOUNT, REASON, REFERENCE_ID, BALANCE_AFTER, HAPPENED_AT
       FROM WALLET_TRANSACTIONS
       WHERE WALLET_ID = $1
       ORDER BY HAPPENED_AT DESC
       LIMIT 50`,
      [wallet.wallet_id],
    );

    res.json({
      wallet,
      transactions: transactionsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch wallet" });
  }
});

// POST /wallet/add-money
// Creates a pending ADD_MONEY_REQUESTS row. Approving it (STATUS = 'approved')
// fires the trigger that actually deposits the money via WALLET_TRANSACTIONS.
router.post("/add-money", verifyToken, async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.user_id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ADD_MONEY_REQUESTS (REQUEST_ID, USER_ID, AMOUNT)
       VALUES (fn_generate_id('AMR'), $1, $2)
       RETURNING REQUEST_ID, STATUS`,
      [userId, amount],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit add-money request" });
  }
});

// GET /wallet/add-money/mine
// Lists the logged-in user's own add-money request history.
router.get("/add-money/mine", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT REQUEST_ID, AMOUNT, STATUS, REQUESTED_AT, PROCESSED_AT
       FROM ADD_MONEY_REQUESTS
       WHERE USER_ID = $1
       ORDER BY REQUESTED_AT DESC`,
      [req.user.user_id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch requests" });
  }
});

export default router;
