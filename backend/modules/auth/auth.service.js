const bcrypt = require("bcryptjs");
const { signToken } = require("./jwt.util");
const {
  issueRefreshSession,
  revokeAllRefreshSessionsForUser,
} = require("./authSession.service");
const db = require("../../db");
const { getUserByEmployeeID, getUserByID, updateLastLogin } = require("../../users/users.service");

async function loginUser(student_employee_id, password, rememberMe = false) {
  const user = await getUserByEmployeeID(student_employee_id);
  if (!user || !user.is_active) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: user.must_change_password,
  };

  const token = signToken(payload);
  const refreshToken = await issueRefreshSession(
    user.id,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    rememberMe
  );

  if (user.must_change_password) {
    return { mustChangePassword: true, token, refreshToken };
  }

  await updateLastLogin(user.id);

  return { token, refreshToken, role: user.role };
}

async function changePassword(userId, oldPassword, newPassword, rememberMe = false) {
  const user = await getUserByID(userId);
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
  await db.query(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    [newHash, userId]
  );

  await revokeAllRefreshSessionsForUser(userId);

  // Issue both a new access token and a new refresh token
  // so the old refresh token can no longer be used
  const token = signToken({
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: false,
  });

  const refreshToken = await issueRefreshSession(
    user.id,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    rememberMe
  );

  return {
    message: "Password changed successfully",
    token,
    refreshToken,
  };
}

module.exports = { loginUser, changePassword };
