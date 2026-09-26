import bcrypt = require("bcryptjs");
import auth = require("./jwt.util");
import authSessions = require("./authSession.service");
import repository = require("./auth.repository");
import users = require("../users/users.service");
import device = require("./authDevice");
import analytics = require("../analytics/analytics.audit.service");
import type { AcademicTermStatus, AuthAuditContext, AuthUser } from "./auth.types";

const getTermStatus = async (user: AuthUser): Promise<AcademicTermStatus> => {
  if (user.role !== "student") return { term_status: "not_applicable", academic_term_name: null };
  const term = await repository.getAcademicTerm(user.academic_term_id ?? null);
  if (!term || new Date(term.ends_on) < new Date(new Date().toDateString())) {
    return { term_status: "expired", academic_term_name: term?.name ?? null };
  }
  return { term_status: "current", academic_term_name: term.name };
};

const recordAuthAuditEvent = async (
  userId: number,
  eventType: string,
  { deviceType = "unknown" }: AuthAuditContext = {},
): Promise<void> => {
  const normalizedDeviceType = device.normalizeDeviceType(deviceType);
  await repository.recordAuthAuditEvent(userId, eventType, normalizedDeviceType);
  const descriptions: Record<string, string> = {
    login: "Signed in",
    logout: "Signed out",
    password_changed: "Changed their password",
  };
  await analytics.recordAuditEvent({
    actorId: userId,
    category: "auth",
    action: eventType,
    description: descriptions[eventType] ?? `Completed ${eventType}`,
    route: "/api/auth",
    metadata: { device_type: normalizedDeviceType },
  });
};

async function loginUser(
  student_employee_id: string,
  password: string,
  rememberMe = false,
  auditContext: AuthAuditContext = {},
): Promise<{
  token: string;
  refreshToken: string;
  mustChangePassword?: boolean;
  role?: string;
  term_status?: AcademicTermStatus["term_status"];
  academic_term_name?: string | null;
}> {
  const user = await users.getUserByEmployeeID(student_employee_id);
  if (!user || !user.is_active) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const termStatus = await getTermStatus(user);
  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: user.must_change_password,
    ...termStatus,
  };

  const token = auth.signToken(payload);
  const refreshToken = await authSessions.issueRefreshSession(
    user.id,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    rememberMe,
  );

  await users.updateLastLogin(user.id);
  await recordAuthAuditEvent(user.id, "login", auditContext);

  if (user.must_change_password) {
    return { mustChangePassword: true, token, refreshToken };
  }

  return { token, refreshToken, role: user.role, ...termStatus };
}

async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string,
  rememberMe = false,
  auditContext: AuthAuditContext = {},
) {
  const user = await users.getUserByID(userId);
  if (!user) throw new Error("User not found");

  // Validate new password before doing anything
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }
  if (oldPassword === newPassword) {
    throw new Error("New password must be different from the old password");
  }

  // Verify old password
  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) throw new Error("Old password is incorrect");

  // Hash and update
  const newHash = await bcrypt.hash(newPassword, 12);
  await repository.updatePassword(userId, newHash);

  await authSessions.revokeAllRefreshSessionsForUser(userId);
  await recordAuthAuditEvent(user.id, "password_changed", auditContext);

  // Issue both a new access token and a new refresh token
  // so the old refresh token can no longer be used
  const token = auth.signToken({
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: false,
    ...(await getTermStatus(user)),
  });

  const refreshToken = await authSessions.issueRefreshSession(
    user.id,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    rememberMe,
  );

  return {
    message: "Password changed successfully",
    token,
    refreshToken,
  };
}

export = { loginUser, changePassword, getTermStatus, recordAuthAuditEvent };
