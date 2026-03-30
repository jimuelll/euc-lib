const { changePassword } = require("./auth.service");
const {
  getRememberMeFromCookies,
  setRefreshAuthCookies,
} = require("./auth.cookies");

async function handleChangePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password are required" });
    }

    const rememberMe = getRememberMeFromCookies(req);
    const result = await changePassword(userId, oldPassword, newPassword, rememberMe);

    setRefreshAuthCookies(res, result.refreshToken, rememberMe);

    res.json({
      accessToken: result.token,
      token: result.token,
      message: result.message,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

module.exports = { handleChangePassword };
