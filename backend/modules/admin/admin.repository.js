const db = require("../../db");

function getConnection() {
  return db.getConnection();
}

async function findActiveProgram(programId) {
  const [[program]] = await db.query("SELECT id FROM academic_programs WHERE id = ? AND is_active = 1 LIMIT 1", [programId]);
  return program || null;
}

async function findActiveDepartment(departmentId) {
  const [[department]] = await db.query("SELECT id FROM departments WHERE id = ? AND is_active = 1 LIMIT 1", [departmentId]);
  return department || null;
}

async function findExistingUser(studentEmployeeId) {
  const [users] = await db.query("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL", [studentEmployeeId]);
  return users;
}

async function findAcademicTerm(termId) {
  const [[term]] = await db.query("SELECT id FROM academic_terms WHERE id = ? LIMIT 1", [termId]);
  return term || null;
}

async function findCurrentAcademicTerm() {
  const [[term]] = await db.query("SELECT id FROM academic_terms WHERE is_current = 1 LIMIT 1");
  return term || null;
}

async function createUser({ studentEmployeeId, libraryCardNumber, studentNumber, employeeNumber, username, email, name, passwordHash, role, address, contact, programId, academicTermId, yearLevel, departmentId, remarks }) {
  const [result] = await db.query(
    `INSERT INTO users
      (student_employee_id, library_card_number, student_number, employee_number, username, email, name, password_hash, role, is_active, must_change_password, address, contact, program_id, academic_term_id, year_level, department_id, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [studentEmployeeId, libraryCardNumber, studentNumber, employeeNumber, username, email || null, name, passwordHash, role, address || "", contact || "", programId, academicTermId, yearLevel, departmentId, remarks]
  );
  const userId = result.insertId;
  const barcode = `LIB-USER-${String(userId).padStart(6, "0")}`;
  await db.query("UPDATE users SET barcode = ? WHERE id = ?", [barcode, userId]);
  return barcode;
}

async function findUserForUpdate(studentEmployeeId, conn) {
  const [[user]] = await conn.query("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE", [studentEmployeeId]);
  return user || null;
}

async function findActiveBorrowings(userId, conn) {
  const [rows] = await conn.query("SELECT id FROM borrowings WHERE user_id = ? AND status IN ('borrowed', 'overdue') FOR UPDATE", [userId]);
  return rows;
}

async function findActiveReservations(userId, conn) {
  const [rows] = await conn.query("SELECT id FROM reservations WHERE user_id = ? AND status IN ('pending', 'ready') AND deleted_at IS NULL FOR UPDATE", [userId]);
  return rows;
}

async function deactivateUser(userId, requesterId, conn) {
  await conn.query("UPDATE users SET is_active = 0, deleted_at = NOW(), deleted_by = ? WHERE id = ?", [requesterId, userId]);
}

async function findArchivedUser(studentEmployeeId) {
  const [users] = await db.query("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NOT NULL", [studentEmployeeId]);
  return users[0] || null;
}

async function restoreUser(studentEmployeeId) {
  await db.query("UPDATE users SET deleted_at = NULL, deleted_by = NULL, is_active = 1 WHERE student_employee_id = ?", [studentEmployeeId]);
}

async function findActiveUser(studentEmployeeId) {
  const [users] = await db.query("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL", [studentEmployeeId]);
  return users[0] || null;
}

async function updateUser(studentEmployeeId, updates) {
  const fields = Object.keys(updates);
  if (!fields.length) return;
  await db.query(
    `UPDATE users SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")} WHERE student_employee_id = ? AND deleted_at IS NULL`,
    [...fields.map((field) => updates[field]), studentEmployeeId]
  );
}

async function searchUsers({ allowedRoles, showArchived, studentEmployeeId, name, role, status, page, limit = 25 }) {
  let sql = `SELECT u.student_employee_id, u.library_card_number, u.student_number, u.employee_number, u.username, u.email, u.name, u.role, u.is_active, u.address, u.contact, u.program_id, u.year_level, u.department_id, u.remarks,
                    p.name AS program_course, d.name AS department_name, u.deleted_at
             FROM users u LEFT JOIN academic_programs p ON p.id = u.program_id LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}
               AND u.role IN (${allowedRoles.map(() => "?").join(", ")})`;
  const values = [...allowedRoles];
  if (studentEmployeeId && name) {
    sql += " AND (u.student_employee_id = ? OR u.name LIKE ?)";
    values.push(studentEmployeeId, `%${name}%`);
  } else {
    if (studentEmployeeId) { sql += " AND u.student_employee_id = ?"; values.push(studentEmployeeId); }
    if (name) { sql += " AND u.name LIKE ?"; values.push(`%${name}%`); }
  }
  if (role) { sql += " AND u.role = ?"; values.push(role); }
  if (status === "active") sql += " AND u.is_active = 1";
  else if (status === "inactive") sql += " AND u.is_active = 0";
  if (page === undefined) {
    const [rows] = await db.query(`${sql} ORDER BY u.name ASC`, values);
    return rows;
  }
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM (${sql}) AS matching_users`, values);
  const [rows] = await db.query(`${sql} ORDER BY u.name ASC LIMIT ? OFFSET ?`, [...values, safeLimit, (safePage - 1) * safeLimit]);
  return { rows, total: Number(total), page: safePage, limit: safeLimit };
}

async function queryToolsSearch(term, allowedRoles) {
  const like = `%${term}%`;
  const [users, books, borrowings, reservations, notifications] = await Promise.all([
    db.query(
      `SELECT id, student_employee_id, name, role, is_active FROM users
       WHERE deleted_at IS NULL AND role IN (${allowedRoles.map(() => "?").join(", ")})
         AND (student_employee_id LIKE ? OR name LIKE ? OR barcode LIKE ?)
       ORDER BY name ASC LIMIT 10`,
      [...allowedRoles, like, like, like]
    ),
    db.query(
      `SELECT id, title, author, isbn, copies,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) AS category,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.location')) AS location
       FROM books WHERE deleted_at IS NULL AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)
       ORDER BY title ASC LIMIT 10`,
      [like, like, like]
    ),
    db.query(
      `SELECT b.id, b.status, b.borrowed_at, b.due_date, b.returned_at,
         u.name AS user_name, u.student_employee_id, bk.title AS book_title, bc.barcode AS copy_barcode
       FROM borrowings b JOIN users u ON u.id = b.user_id JOIN books bk ON bk.id = b.book_id LEFT JOIN book_copies bc ON bc.id = b.copy_id
       WHERE b.deleted_at IS NULL AND (u.student_employee_id LIKE ? OR u.name LIKE ? OR bk.title LIKE ? OR bk.isbn LIKE ? OR bc.barcode LIKE ? OR CAST(b.id AS CHAR) LIKE ?)
       ORDER BY b.borrowed_at DESC LIMIT 10`,
      [like, like, like, like, like, like]
    ),
    db.query(
      `SELECT r.id, r.status, r.reserved_at, r.expires_at, u.name AS user_name, u.student_employee_id, bk.title AS book_title
       FROM reservations r JOIN users u ON u.id = r.user_id JOIN books bk ON bk.id = r.book_id
       WHERE r.deleted_at IS NULL AND (u.student_employee_id LIKE ? OR u.name LIKE ? OR bk.title LIKE ? OR CAST(r.id AS CHAR) LIKE ?)
       ORDER BY r.reserved_at DESC LIMIT 10`,
      [like, like, like, like]
    ),
    db.query(
      `SELECT n.id, n.type, n.title, n.created_at, n.audience_type, n.audience_role
       FROM notifications n WHERE n.title LIKE ? OR n.body LIKE ? OR n.type LIKE ? OR CAST(n.id AS CHAR) LIKE ?
       ORDER BY n.created_at DESC LIMIT 10`,
      [like, like, like, like]
    ),
  ]);
  return { users: users[0], books: books[0], borrowings: borrowings[0], reservations: reservations[0], notifications: notifications[0] };
}

async function findStudentLikeUsers() {
  const roles = ["student", "employee", "alumni"];
  const [users] = await db.query(
    `SELECT u.id, u.student_employee_id, u.role,
       COUNT(CASE WHEN b.status IN ('borrowed', 'overdue') THEN 1 END) AS active_borrow_count
     FROM users u LEFT JOIN borrowings b ON b.user_id = u.id AND b.deleted_at IS NULL
     WHERE u.deleted_at IS NULL AND u.is_active = 1 AND u.role IN (${roles.map(() => "?").join(", ")})
     GROUP BY u.id, u.student_employee_id, u.role`,
    roles
  );
  return users;
}

async function bulkDeactivateUserIds(userIds, requesterId) {
  if (!userIds.length) return;
  await db.query(
    `UPDATE users SET is_active = 0, deleted_at = NOW(), deleted_by = ?
     WHERE deleted_at IS NULL AND is_active = 1 AND id IN (${userIds.map(() => "?").join(", ")})`,
    [requesterId, ...userIds]
  );
}

module.exports = { getConnection, findActiveProgram, findActiveDepartment, findExistingUser, findAcademicTerm, findCurrentAcademicTerm, createUser, findUserForUpdate, findActiveBorrowings, findActiveReservations, deactivateUser, findArchivedUser, restoreUser, findActiveUser, updateUser, searchUsers, queryToolsSearch, findStudentLikeUsers, bulkDeactivateUserIds };
