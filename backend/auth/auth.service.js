const bcrypt = require("bcryptjs");
const { signToken, signRefreshToken } = require("./jwt.util");
const db = require("../db");
const { getUserByEmployeeID, updateUserPassword, updateLastLogin } = require("../users/users.service");

async function loginUser(student_employee_id, password) {
  const user = await getUserByEmployeeID(student_employee_id);
  if (!user) throw new Error("User not found");
  if (!user.is_active) throw new Error("Account is inactive");

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new Error("Invalid password");

  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: user.must_change_password
  };

  const token = signToken(payload);
  const refreshToken = signRefreshToken({ id: user.id }); // minimal payload for refresh

  // if password must be changed
  if (user.must_change_password) {
    return { mustChangePassword: true, token, refreshToken };
  }

  await updateLastLogin(user.id);

  return { token, refreshToken, role: user.role };
}

// Change password for a user
async function changePassword(userId, oldPassword, newPassword) {
  // Get user from DB
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
  if (!rows.length) throw new Error("User not found");
  const user = rows[0];

  // Verify old password
  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) throw new Error("Old password is incorrect");

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 12);

  // Update password and reset must_change_password
  await db.query(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
    [newHash, userId]
  );

  const token = signToken({
    id: user.id,
    role: user.role,
    name: user.name,
    must_change_password: false, // ← was incorrectly re-reading old value
  });

  return {
    message: "Password changed successfully",
    token,
  };
}

module.exports = { loginUser, changePassword };