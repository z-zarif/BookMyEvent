import jwt from "jsonwebtoken";

// Verifies the admin token issued by POST /admin-auth/login. Completely
// separate from verifyToken (customer auth) - no USERS lookup, no
// TOKEN_BLACKLIST check, no customer session involved at all.
export const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No admin token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.admin = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired admin token" });
  }
};
