const db = require("../../db");

const findByEmployeeId = async (studentEmployeeId) => {
  const [rows] = await db.query("SELECT * FROM users WHERE student_employee_id = ?", [studentEmployeeId]);
  return rows[0] || null;
};

const findById = async (id) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
};

const updatePassword = (userId, newPasswordHash) => db.query(
  "UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?",
  [newPasswordHash, userId],
);

const updateLastLogin = (userId) => db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [userId]);

module.exports = { findByEmployeeId, findById, updatePassword, updateLastLogin };
