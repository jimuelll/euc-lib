const express = require("express");
const { signToken, verifyRefreshToken } = require("./jwt.util");
const { loginUser } = require("./auth.service");
const { getUserByID } = require("../../users/users.service");
const { loginLimiter } = require("../../middlewares/rateLimiter");
const { authMiddleware } = require("./auth.middleware");
const { handleChangePassword } = require("./auth.controller");
const {
  revokeRefreshSession,
  rotateRefreshSession,
} = require("./authSession.service");
const {
  clearRefreshAuthCookies,
  getRefreshTokenFromCookies,
  setRefreshAuthCookies,
} = require("./auth.cookies");

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { student_employee_id, password, rememberMe = false } = req.body;
    const result = await loginUser(student_employee_id, password, Boolean(rememberMe));
    setRefreshAuthCookies(res, result.refreshToken, Boolean(rememberMe));
    res.json({
      accessToken: result.token,
      mustChangePassword: result.mustChangePassword ?? false,
      role: result.role,
    });
  } catch (err) {
    res.status(err.status || 401).json({ message: "Invalid credentials" });
  }
});

router.post("/change-password", authMiddleware(), handleChangePassword);

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromCookies(req);
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    const payload = verifyRefreshToken(refreshToken);
    if (!payload?.jti) throw new Error("Missing refresh token session");

    const user = await getUserByID(payload.id);
    if (!user) throw new Error("User not found");
    if (!user.is_active) throw new Error("User inactive");

    const nextRefreshToken = await rotateRefreshSession(
      user.id,
      payload.jti,
      new Date((payload.exp || 0) * 1000),
      Boolean(payload.remember_me)
    );
    setRefreshAuthCookies(res, nextRefreshToken, Boolean(payload.remember_me));

    const accessToken = signToken({
      id: user.id,
      role: user.role,
      name: user.name,
      must_change_password: user.must_change_password,
    });

    res.json({ accessToken });
  } catch (err) {
    clearRefreshAuthCookies(res);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromCookies(req);

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload?.id && payload?.jti) {
        await revokeRefreshSession(payload.id, payload.jti);
      }
    }
  } catch {
    // Ignore invalid refresh tokens on logout and return success to clear client state.
  }

  clearRefreshAuthCookies(res);
  res.json({ message: "Logged out" });
});

module.exports = router;
