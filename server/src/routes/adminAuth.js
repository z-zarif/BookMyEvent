import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// POST /admin-auth/login
// Just a shared password, checked against .env - no USERS row, no customer
// account, nothing database-backed. This is intentionally separate from
// how customers/organizers log in.
router.post("/login", (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASSWORD) {
    return res
      .status(503)
      .json({ error: "Admin panel not configured. Set ADMIN_PASSWORD in .env" });
  }

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  // role: "admin" is the only thing this token means - it doesn't carry a
  // user_id because there's no user behind it.
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  res.json({ token });
});

export default router;
