// auth.controller.js
const { changePassword } = require("./auth.service");

async function handleChangePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password are required" });
    }

    const result = await changePassword(userId, oldPassword, newPassword);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "true",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token: result.token, message: result.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = { handleChangePassword };