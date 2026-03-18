const express = require("express");
const { loginUser } = require("./auth.service");
const { loginLimiter } = require("../middlewares/rateLimiter");
const { authMiddleware } = require("./auth.middleware");
const { handleChangePassword } = require("./auth.controller");

const router = express.Router();

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { student_employee_id, password } = req.body;
    const result = await loginUser(student_employee_id, password);

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/change-password", authMiddleware(), handleChangePassword);

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    const payload = verifyToken(refreshToken);
    const user = await getUserByEmployeeID(payload.id);
    if (!user) throw new Error("User not found");

    const accessToken = signToken({
      id: user.id,
      role: user.role,
      name: user.name,
      must_change_password: user.must_change_password
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
  res.json({ message: "Logged out" });
});
module.exports = router;