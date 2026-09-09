import express from "express";
import bycrpt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/db.js";

const router = express.Router();
// Creates a new Express Router to define and organize routes.
//An Express Router is like a mini Express application that lets you group related API routes into a separate file.
//! Creates a POST route for registering a new user.
router.post("/register/user", async (req, res) => {
  const { userName, email, password, gender } = req.body;
  if (!userName || !email || !password || !gender) {
    return res
      .status(400)
      .json({ error: "Name, email, password, gender are required" });
  }
  // Extracts the user's name, email, and password from the request body.
  const client = await pool.connect();
  // Gets a dedicated database connection from the connection pool.

  try {
    await client.query("BEGIN");
    // Starts a database transaction so the following queries can be committed or rolled back together.
    const passwordHash = await bycrpt.hash(password, 10);
    // Hashes the user's password before storing it in the database.
    const result = await client.query(
      `INSERT INTO USERS (USER_ID, USER_NAME, EMAIL, PASSWORD, GENDER)
            VALUES(fn_generate_id('USR'),$1,$2,$3,$4)
            RETURNING USER_ID, USER_NAME, EMAIL`,
      // Provides the values that will be inserted into the five specified columns.
      [userName, email, passwordHash, gender],
      // The parameter array, Supplies values for the SQL placeholders, using null when gender is not provided.
    );
    const user = result.rows[0];
    // Gets the newly inserted user's data from the first returned database row.

    // Every user needs a wallet before they can book anything. WALLETS.BALANCE
    // defaults to 10000, but only once a row actually exists - so we create
    // it here, in the same transaction as the user, right after signup.
    await client.query(
      `INSERT INTO WALLETS (WALLET_ID, USER_ID)
            VALUES (fn_generate_id('WAL'), $1)`,
      [user.user_id],
    );

    await client.query("COMMIT");
    //"Everything in this transaction succeeded. Save the changes permanently."
    // Commits the transaction and permanently saves the new user and their wallet.

    const token = jwt.sign(
      { user_id: user.user_id, role: "user" },
      // Stores the user's ID and role inside the JWT payload.
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    // Creates a signed JWT token for authenticating the user.
    res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    // Rolls back the transaction and undoes any database changes made before the error.
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
  }
});

router.post("/login/user", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and Password are required" });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM USERS WHERE EMAIL=$1`,[email],
    );
    if (result.rows.length == 0) {
      return res.status(403).json({
        error: "Email not found, Please signup first",
      });
    }
    const user = result.rows[0];
    const isPasswordCorrect = await bycrpt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        error: "Incorrect Password. Please try again",
      });
    }

    // Check whether this user is already an organizer, so the JWT role
    // reflects their real status instead of always saying "user". Without
    // this, logging back out and in would forget they became an organizer,
    // and the frontend would wrongly show "Become an Organizer" again.
    const organizerCheck = await pool.query(
      `SELECT ORGANIZER_ID FROM ORGANIZERS WHERE ORGANIZER_ID = $1`,
      [user.user_id],
    );
    const role = organizerCheck.rows.length > 0 ? "organizer" : "user";

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    delete user.password;
    res.status(200).json({
      token,
      user,
    });
  } catch (err) {
    console.error("Login Error:", err); // 7. Added error logging
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// NOTE: the /logout route that was here has been removed for now - it
// referenced verifyToken without importing it, which crashed the whole
// server on startup, and it also inserted into a TOKEN_BLACKLIST table
// that doesn't exist in schema.sql yet. Re-add once both are in place:
// import { verifyToken } from "../middleware/auth.js";
// and a TOKEN_BLACKLIST table with (TOKEN, EXPIRES_AT) columns.

export default router;