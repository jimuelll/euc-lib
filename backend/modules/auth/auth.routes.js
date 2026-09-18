const express = require("express");
const { loginLimiter } = require("../../middlewares/rateLimiter");
const { authMiddleware } = require("./auth.middleware");
const { handleLogin, handleChangePassword, handleRefresh, handleLogout } = require("./auth.controller");

const router = express.Router();

router.post("/login", loginLimiter, handleLogin);
router.post("/change-password", authMiddleware(), handleChangePassword);
router.post("/refresh", handleRefresh);
router.post("/logout", handleLogout);

module.exports = router;
