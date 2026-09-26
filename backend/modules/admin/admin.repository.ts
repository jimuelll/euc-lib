import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AdminEntityIdRow,
  AdminUserRow,
  NewUserRecord,
  SearchUserRow,
  SearchUsersOptions,
  SearchUsersPage,
  UserUpdateRecord,
} from "./admin.types";

const db = require("../../db") as Pool;
type QueryConnection = Pool | PoolConnection;
type SqlParameter = string | number | boolean | null;

const getConnection = (): Promise<PoolConnection> => db.getConnection();

const findActiveProgram = async (programId: number | string, conn: QueryConnection = db): Promise<AdminEntityIdRow | null> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM academic_programs WHERE id = ? AND is_active = 1 LIMIT 1 FOR UPDATE", [programId]);
  return rows[0] ?? null;
};

const findActiveDepartment = async (departmentId: number | string, conn: QueryConnection = db): Promise<AdminEntityIdRow | null> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM departments WHERE id = ? AND is_active = 1 LIMIT 1 FOR UPDATE", [departmentId]);
  return rows[0] ?? null;
};

const findExistingUser = async (studentEmployeeId: string, conn: QueryConnection = db): Promise<AdminUserRow[]> => {
  const [users] = await conn.query<AdminUserRow[]>("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE", [studentEmployeeId]);
  return users;
};

const findAcademicTerm = async (termId: number | string, conn: QueryConnection = db): Promise<AdminEntityIdRow | null> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM academic_terms WHERE id = ? LIMIT 1 FOR UPDATE", [termId]);
  return rows[0] ?? null;
};

const findCurrentAcademicTerm = async (conn: QueryConnection = db): Promise<AdminEntityIdRow | null> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM academic_terms WHERE is_current = 1 LIMIT 1");
  return rows[0] ?? null;
};

const createUser = async ({ studentEmployeeId, libraryCardNumber, studentNumber, employeeNumber, username, email, name, passwordHash, role, address, contact, programId, academicTermId, yearLevel, departmentId, remarks }: NewUserRecord, conn: QueryConnection = db): Promise<string> => {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO users
      (student_employee_id, library_card_number, student_number, employee_number, username, email, name, password_hash, role, is_active, must_change_password, address, contact, program_id, academic_term_id, year_level, department_id, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [studentEmployeeId, libraryCardNumber, studentNumber, employeeNumber, username, email || null, name, passwordHash, role, address || "", contact || "", programId, academicTermId, yearLevel, departmentId, remarks],
  );
  const userId = result.insertId;
  const barcode = `LIB-USER-${String(userId).padStart(6, "0")}`;
  await conn.query("UPDATE users SET barcode = ? WHERE id = ?", [barcode, userId]);
  return barcode;
};

const findUserForUpdate = async (studentEmployeeId: string, conn: PoolConnection): Promise<AdminUserRow | null> => {
  const [rows] = await conn.query<AdminUserRow[]>("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL FOR UPDATE", [studentEmployeeId]);
  return rows[0] ?? null;
};

const findActiveBorrowings = async (userId: number, conn: PoolConnection): Promise<AdminEntityIdRow[]> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM borrowings WHERE user_id = ? AND deleted_at IS NULL AND status IN ('borrowed', 'overdue') FOR UPDATE", [userId]);
  return rows;
};

const findAllBorrowingIdsForUser = async (userId: number, conn: PoolConnection): Promise<number[]> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM borrowings WHERE user_id = ? ORDER BY id FOR UPDATE", [userId]);
  return rows.map((row) => Number(row.id));
};

const findActiveReservations = async (userId: number, conn: PoolConnection): Promise<AdminEntityIdRow[]> => {
  const [rows] = await conn.query<AdminEntityIdRow[]>("SELECT id FROM reservations WHERE user_id = ? AND status IN ('pending', 'ready') AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE", [userId]);
  return rows;
};

const deactivateUser = async (userId: number, requesterId: number, conn: PoolConnection): Promise<void> => {
  await conn.query("UPDATE users SET is_active = 0, deleted_at = NOW(), deleted_by = ? WHERE id = ?", [requesterId, userId]);
};

const findArchivedUser = async (studentEmployeeId: string, conn: QueryConnection = db): Promise<AdminUserRow | null> => {
  const [users] = await conn.query<AdminUserRow[]>("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NOT NULL FOR UPDATE", [studentEmployeeId]);
  return users[0] ?? null;
};

const restoreUser = async (studentEmployeeId: string, conn: QueryConnection = db): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE users SET deleted_at = NULL, deleted_by = NULL, is_active = 1 WHERE student_employee_id = ? AND deleted_at IS NOT NULL", [studentEmployeeId]);
  return Number(result.affectedRows);
};

const findUserByIdForAudit = async (userId: number, conn: QueryConnection = db): Promise<AdminUserRow | null> => {
  const [rows] = await conn.query<AdminUserRow[]>(
    `SELECT id, name, student_employee_id, email, role, is_active, program_id, academic_term_id,
            department_id, address, contact, year_level, remarks, deleted_at
       FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
};

const findActiveUser = async (studentEmployeeId: string): Promise<AdminUserRow | null> => {
  const [users] = await db.query<AdminUserRow[]>("SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL", [studentEmployeeId]);
  return users[0] ?? null;
};

const findActiveUserBarcode = async (studentEmployeeId: string): Promise<(RowDataPacket & { barcode: string | null }) | null> => {
  const [rows] = await db.query<Array<RowDataPacket & { barcode: string | null }>>(
    "SELECT COALESCE(NULLIF(TRIM(barcode), ''), student_employee_id) AS barcode FROM users WHERE student_employee_id = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1",
    [studentEmployeeId],
  );
  return rows[0] ?? null;
};

const updateUser = async (studentEmployeeId: string, updates: UserUpdateRecord, conn: QueryConnection = db): Promise<number | undefined> => {
  const fields = Object.keys(updates);
  if (!fields.length) return;
  const [result] = await conn.query<ResultSetHeader>(
    `UPDATE users SET ${fields.map((field) => `\`${field}\` = ?`).join(", ")} WHERE student_employee_id = ? AND deleted_at IS NULL`,
    [...fields.map((field) => updates[field] as SqlParameter), studentEmployeeId],
  );
  return result.affectedRows;
};

const searchUsers = async ({ allowedRoles, showArchived, studentEmployeeId, name, role, status, page, limit = 25 }: SearchUsersOptions): Promise<SearchUserRow[] | SearchUsersPage> => {
  const expiredStudentTerm = "(u.role = 'student' AND (assigned_term.ends_on IS NULL OR assigned_term.ends_on < CURRENT_DATE()))";
  let sql = `SELECT u.student_employee_id, u.library_card_number, u.student_number, u.employee_number, u.username, u.email, u.name, u.role,
                    CASE WHEN ${expiredStudentTerm} THEN 0 ELSE u.is_active END AS is_active,
                    u.address, u.contact, u.program_id, u.academic_term_id, u.year_level, u.department_id, u.remarks,
                    p.name AS program_course, d.name AS department_name, u.deleted_at
             FROM users u LEFT JOIN academic_programs p ON p.id = u.program_id LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN academic_terms assigned_term ON assigned_term.id = u.academic_term_id
             WHERE u.deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}
               AND u.role IN (${allowedRoles.map(() => "?").join(", ")})`;
  const values: SqlParameter[] = [...allowedRoles];
  if (studentEmployeeId && name) {
    sql += " AND (u.student_employee_id = ? OR u.name LIKE ?)";
    values.push(String(studentEmployeeId), `%${String(name)}%`);
  } else {
    if (studentEmployeeId) { sql += " AND u.student_employee_id = ?"; values.push(String(studentEmployeeId)); }
    if (name) { sql += " AND u.name LIKE ?"; values.push(`%${String(name)}%`); }
  }
  if (role) { sql += " AND u.role = ?"; values.push(String(role)); }
  if (status === "active") sql += ` AND u.is_active = 1 AND NOT ${expiredStudentTerm}`;
  else if (status === "inactive") sql += ` AND (u.is_active = 0 OR ${expiredStudentTerm})`;
  if (page === undefined) {
    const [rows] = await db.query<SearchUserRow[]>(`${sql} ORDER BY u.name ASC`, values);
    return rows;
  }
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const [countRows] = await db.query<Array<RowDataPacket & { total: number | string }>>(`SELECT COUNT(*) AS total FROM (${sql}) AS matching_users`, values);
  const [rows] = await db.query<SearchUserRow[]>(`${sql} ORDER BY u.name ASC LIMIT ? OFFSET ?`, [...values, safeLimit, (safePage - 1) * safeLimit]);
  return { rows, total: Number(countRows[0].total), page: safePage, limit: safeLimit };
};

const queryToolsSearch = async (term: string, allowedRoles: string[]) => {
  const like = `%${term}%`;
  const [users, books, borrowings, reservations, notifications] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT id, student_employee_id, name, role, is_active FROM users
       WHERE deleted_at IS NULL AND role IN (${allowedRoles.map(() => "?").join(", ")})
         AND (student_employee_id LIKE ? OR name LIKE ? OR barcode LIKE ?)
       ORDER BY name ASC LIMIT 10`,
      [...allowedRoles, like, like, like],
    ),
    db.query<RowDataPacket[]>(
      `SELECT id, title, author, isbn, copies,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.category')) AS category,
              (SELECT GROUP_CONCAT(DISTINCT h.location ORDER BY h.location SEPARATOR ', ')
                 FROM book_copies bc
                 JOIN copy_holdings h ON h.copy_id = bc.id
                WHERE bc.book_id = books.id AND bc.deleted_at IS NULL) AS location
       FROM books WHERE deleted_at IS NULL AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)
       ORDER BY title ASC LIMIT 10`,
      [like, like, like],
    ),
    db.query<RowDataPacket[]>(
      `SELECT b.id, b.status, b.borrowed_at, b.due_date, b.returned_at,
         u.name AS user_name, u.student_employee_id, bk.title AS book_title, bc.barcode AS copy_barcode
       FROM borrowings b JOIN users u ON u.id = b.user_id JOIN books bk ON bk.id = b.book_id LEFT JOIN book_copies bc ON bc.id = b.copy_id
       WHERE b.deleted_at IS NULL AND (u.student_employee_id LIKE ? OR u.name LIKE ? OR bk.title LIKE ? OR bk.isbn LIKE ? OR bc.barcode LIKE ? OR CAST(b.id AS CHAR) LIKE ?)
       ORDER BY b.borrowed_at DESC LIMIT 10`,
      [like, like, like, like, like, like],
    ),
    db.query<RowDataPacket[]>(
      `SELECT r.id, r.status, r.reserved_at, r.expires_at, u.name AS user_name, u.student_employee_id, bk.title AS book_title
       FROM reservations r JOIN users u ON u.id = r.user_id JOIN books bk ON bk.id = r.book_id
       WHERE r.deleted_at IS NULL AND (u.student_employee_id LIKE ? OR u.name LIKE ? OR bk.title LIKE ? OR CAST(r.id AS CHAR) LIKE ?)
       ORDER BY r.reserved_at DESC LIMIT 10`,
      [like, like, like, like],
    ),
    db.query<RowDataPacket[]>(
      `SELECT n.id, n.type, n.title, n.created_at, n.audience_type, n.audience_role
       FROM notifications n WHERE n.title LIKE ? OR n.body LIKE ? OR n.type LIKE ? OR CAST(n.id AS CHAR) LIKE ?
       ORDER BY n.created_at DESC LIMIT 10`,
      [like, like, like, like],
    ),
  ]);
  return { users: users[0], books: books[0], borrowings: borrowings[0], reservations: reservations[0], notifications: notifications[0] };
};

export = { getConnection, findActiveProgram, findActiveDepartment, findExistingUser, findAcademicTerm, findCurrentAcademicTerm, createUser, findUserForUpdate, findActiveBorrowings, findAllBorrowingIdsForUser, findActiveReservations, deactivateUser, findArchivedUser, restoreUser, findUserByIdForAudit, findActiveUser, findActiveUserBarcode, updateUser, searchUsers, queryToolsSearch };
