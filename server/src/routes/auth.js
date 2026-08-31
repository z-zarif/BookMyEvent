import express from "express";
import bycrpt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/db.js";

const router = express.Router();
// Creates a new Express Router to define and organize routes.
//An Express Router is like a mini Express application that lets you group related API routes into a separate file.
router.post("/register/user", async (req, res) => {
  // Creates a POST route for registering a new user.
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
    await client.query("COMMIT");
    //"Everything in this transaction succeeded. Save the changes permanently."
    // Commits the transaction and permanently saves the new user.
    const user = result.rows[0];
    // Gets the newly inserted user's data from the first returned database row.

    const token = jwt.sign(
      { user_id: user.user_id, role: "user" },
      // Stores the user's ID and role inside the JWT payload.
      process.env.JWT_SECRET,
      // Gets the secret key used to sign and verify JWT tokens.
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
    const token = jwt.sign(
      {
        user_id: user.user_id,
        role: "user",
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
export default router;
