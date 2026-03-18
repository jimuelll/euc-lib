const db = require("../db");

// Get user by student_employee_id
async function getUserByEmployeeID(student_employee_id) {
  const [rows] = await db.query("SELECT * FROM users WHERE student_employee_id = ?", [student_employee_id]);
  return rows[0] || null;
}

// Get user by ID
async function getUserByID(id) {
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

// Update user password & reset must_change_password
async function updateUserPassword(userId, newPasswordHash) {
  await db.query(
    "UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?",
    [newPasswordHash, userId]
  );
}

// Update last login timestamp
async function updateLastLogin(userId) {
  await db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [userId]);
}

// Export functions
module.exports = {
  getUserByEmployeeID,
  getUserByID,
  updateUserPassword,
  updateLastLogin,
};