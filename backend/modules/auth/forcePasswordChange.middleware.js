const db = require("../../db");

async function forcePasswordChange(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const [rows] = await db.query("SELECT must_change_password FROM users WHERE id = ?", [req.user.id]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });

  if (rows[0].must_change_password) {
    return res.status(403).json({
      message: "Password must be changed before using the system",
      mustChangePassword: true,
    });
  }

  next();
}

module.exports = { forcePasswordChange };