import type { Request, RequestHandler } from "express";
import auth = require("./jwt.util");
import service = require("./auth.service");
import users = require("../users/users.service");
import device = require("./authDevice");
import sessions = require("./authSession.service");
import cookies = require("./auth.cookies");
import type { AuthTokenPayload } from "./auth.types";

type AuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
  cookies?: Record<string, string | undefined>;
};
type RequestError = { status?: number; message?: string };

const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { student_employee_id, password, rememberMe = false } = req.body;
    const result = await service.loginUser(
      student_employee_id,
      password,
      Boolean(rememberMe),
      device.getAuthAuditContext(req),
    );
    cookies.setRefreshAuthCookies(res, result.refreshToken, Boolean(rememberMe));
    res.json({ accessToken: result.token, mustChangePassword: result.mustChangePassword ?? false, role: result.role });
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(requestError?.status || 401).json({ message: "Invalid credentials" });
  }
};

const handleChangePassword: RequestHandler = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: "Both old and new password are required" });
      return;
    }
    const rememberMe = cookies.getRememberMeFromCookies(req as AuthenticatedRequest);
    const authenticatedUser = (req as AuthenticatedRequest).user!;
    const result = await service.changePassword(
      authenticatedUser.id,
      oldPassword,
      newPassword,
      rememberMe,
      device.getAuthAuditContext(req),
    );
    cookies.setRefreshAuthCookies(res, result.refreshToken, rememberMe);
    res.json({ accessToken: result.token, token: result.token, message: result.message });
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(400).json({ message: requestError?.message });
  }
};

const handleRefresh: RequestHandler = async (req, res) => {
  try {
    const refreshToken = cookies.getRefreshTokenFromCookies(req as AuthenticatedRequest);
    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token" });
      return;
    }
    const payload = auth.verifyRefreshToken(refreshToken) as AuthTokenPayload;
    if (!payload?.jti) throw new Error("Missing refresh token session");
    if (!(await sessions.isAccessTokenCurrent(payload))) throw new Error("Refresh token predates the most recent system restore");
    const user = await users.getUserByID(payload.id);
    if (!user) throw new Error("User not found");
    if (!user.is_active) throw new Error("User inactive");
    const nextRefreshToken = await sessions.rotateRefreshSession(
      user.id,
      payload.jti,
      new Date((payload.exp || 0) * 1000),
      Boolean(payload.remember_me),
    );
    cookies.setRefreshAuthCookies(res, nextRefreshToken, Boolean(payload.remember_me));
    const termStatus = await service.getTermStatus(user);
    res.json({ accessToken: auth.signToken({
      id: user.id,
      role: user.role,
      name: user.name,
      must_change_password: user.must_change_password,
      ...termStatus,
    }) });
  } catch {
    cookies.clearRefreshAuthCookies(res);
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

const handleLogout: RequestHandler = async (req, res) => {
  try {
    const refreshToken = cookies.getRefreshTokenFromCookies(req as AuthenticatedRequest);
    if (refreshToken) {
      const payload = auth.verifyRefreshToken(refreshToken) as AuthTokenPayload;
      if (payload?.id && payload?.jti) {
        await sessions.revokeRefreshSession(payload.id, payload.jti);
        await service.recordAuthAuditEvent(payload.id, "logout", device.getAuthAuditContext(req));
      }
    }
  } catch { /* Invalid refresh tokens are still cleared successfully. */ }
  cookies.clearRefreshAuthCookies(res);
  res.json({ message: "Logged out" });
};

export = { handleLogin, handleChangePassword, handleRefresh, handleLogout };
