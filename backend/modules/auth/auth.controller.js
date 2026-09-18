const { signToken, verifyRefreshToken } = require("./jwt.util");
const { loginUser, recordAuthAuditEvent, getTermStatus, changePassword } = require("./auth.service");
const { getUserByID } = require("../users/users.service");
const { getAuthAuditContext } = require("./authDevice");
const { revokeRefreshSession, rotateRefreshSession, isAccessTokenCurrent } = require("./authSession.service");
const { getRememberMeFromCookies, clearRefreshAuthCookies, getRefreshTokenFromCookies, setRefreshAuthCookies } = require("./auth.cookies");

async function handleLogin(req, res) {
  try {
    const { student_employee_id, password, rememberMe = false } = req.body;
    const result = await loginUser(student_employee_id, password, Boolean(rememberMe), getAuthAuditContext(req));
    setRefreshAuthCookies(res, result.refreshToken, Boolean(rememberMe));
    res.json({ accessToken: result.token, mustChangePassword: result.mustChangePassword ?? false, role: result.role });
  } catch (err) { res.status(err.status || 401).json({ message: "Invalid credentials" }); }
}

async function handleChangePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: "Both old and new password are required" });
    const rememberMe = getRememberMeFromCookies(req);
    const result = await changePassword(req.user.id, oldPassword, newPassword, rememberMe, getAuthAuditContext(req));
    setRefreshAuthCookies(res, result.refreshToken, rememberMe);
    res.json({ accessToken: result.token, token: result.token, message: result.message });
  } catch (err) { res.status(400).json({ message: err.message }); }
}

async function handleRefresh(req, res) {
  try {
    const refreshToken = getRefreshTokenFromCookies(req);
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });
    const payload = verifyRefreshToken(refreshToken);
    if (!payload?.jti) throw new Error("Missing refresh token session");
    if (!(await isAccessTokenCurrent(payload))) throw new Error("Refresh token predates the most recent system restore");
    const user = await getUserByID(payload.id);
    if (!user) throw new Error("User not found");
    if (!user.is_active) throw new Error("User inactive");
    const nextRefreshToken = await rotateRefreshSession(user.id, payload.jti, new Date((payload.exp || 0) * 1000), Boolean(payload.remember_me));
    setRefreshAuthCookies(res, nextRefreshToken, Boolean(payload.remember_me));
    const termStatus = await getTermStatus(user);
    res.json({ accessToken: signToken({ id: user.id, role: user.role, name: user.name, must_change_password: user.must_change_password, ...termStatus }) });
  } catch {
    clearRefreshAuthCookies(res);
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

async function handleLogout(req, res) {
  try {
    const refreshToken = getRefreshTokenFromCookies(req);
    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload?.id && payload?.jti) {
        await revokeRefreshSession(payload.id, payload.jti);
        await recordAuthAuditEvent(payload.id, "logout", getAuthAuditContext(req));
      }
    }
  } catch { /* Invalid refresh tokens are still cleared successfully. */ }
  clearRefreshAuthCookies(res);
  res.json({ message: "Logged out" });
}

module.exports = { handleLogin, handleChangePassword, handleRefresh, handleLogout };
