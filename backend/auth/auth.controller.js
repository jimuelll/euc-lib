const { changePassword } = require("./auth.service");

// POST /auth/change-password
async function handleChangePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id; // set by authMiddleware

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password are required" });
    }

    const result = await changePassword(userId, oldPassword, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = { handleChangePassword };