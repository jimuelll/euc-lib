const { changePassword } = require("./auth.service");

async function handleChangePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password are required" });
    }

    const result = await changePassword(userId, oldPassword, newPassword);

    res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      message: result.message,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = { handleChangePassword };