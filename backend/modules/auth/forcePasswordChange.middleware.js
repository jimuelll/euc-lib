async function forcePasswordChange(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.must_change_password) {
    return res.status(403).json({
      message: "Password must be changed before using the system",
      mustChangePassword: true,
    });
  }

  next();
}

module.exports = { forcePasswordChange };
