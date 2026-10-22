const express = require("express");
const { limiters } = require("../../middlewares/rateLimiter");
const { authMiddleware, identifyRefreshLimitAccount } = require("./auth.middleware");
const { handleLogin, handleChangePassword, handleRefresh, handleLogout } = require("./auth.controller");

const router = express.Router();

router.post("/login", limiters.login, limiters.loginIdentity, handleLogin);
router.post("/change-password", authMiddleware(), limiters.passwordChange, handleChangePassword);
router.post("/refresh", limiters.refreshIp, identifyRefreshLimitAccount, limiters.refreshAccount, handleRefresh);
router.post("/logout", handleLogout);

router.use(require("./account-email.routes").router);
router.use(require("./profile.routes").router);
module.exports = router;
