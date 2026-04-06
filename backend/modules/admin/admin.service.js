const bcrypt = require("bcryptjs");
const db = require("../../db");
const qr = require("qrcode");

const STUDENT_LIKE_ROLES = ["student", "employee", "alumni"];

// Role hierarchy map
const roleHierarchy = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "employee", "alumni", "student"],
  admin: ["admin", "staff", "scanner", "employee", "alumni", "student"],
  staff: ["staff", "scanner", "employee", "alumni", "student"],
};

const searchRoleHierarchy = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "employee", "alumni", "student"],
  admin: ["admin", "staff", "scanner", "employee", "alumni", "student"],
  staff: ["employee", "alumni", "student"],
};

// CREATE USER
async function createUser({ student_employee_id, name, role, password, address, contact }, creatorRole) {
  if (!roleHierarchy[creatorRole]?.includes(role)) {
    throw new Error("You are not allowed to create a user with this role");
  }
  if (role === creatorRole && creatorRole !== "super_admin") {
    throw new Error("You cannot create a user with your own role");
  }

  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL",
    [student_employee_id]
  );
  if (existing.length) throw new Error("User already exists");

  const password_hash = await bcrypt.hash(password, 12);

  const [result] = await db.query(
    `INSERT INTO users 
      (student_employee_id, name, password_hash, role, is_active, must_change_password, address, contact)
      VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
    [student_employee_id, name, password_hash, role, address || "", contact || ""]
  );

  const userId = result.insertId;
  const barcode = `LIB-USER-${String(userId).padStart(6, "0")}`;

  await db.query("UPDATE users SET barcode = ? WHERE id = ?", [barcode, userId]);

  return { message: "User created successfully", barcode };
}

// DELETE USER (soft delete — sets deleted_at + is_active = 0, preserves borrowing history)
async function deleteUser(student_employee_id, requesterRole, requesterId) {
  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL",
    [student_employee_id]
  );
  if (!existing.length) throw new Error("User not found");

  const user = existing[0];

  if (!roleHierarchy[requesterRole]?.includes(user.role)) {
    throw new Error("You are not allowed to deactivate this user");
  }

  if (!user.is_active) {
    throw new Error("User is already deactivated");
  }

  const [[{ active_count }]] = await db.query(
    `SELECT COUNT(*) AS active_count FROM borrowings
     WHERE user_id = ? AND status IN ('borrowed', 'overdue')`,
    [user.id]
  );
  if (active_count > 0) {
    throw new Error(
      `User has ${active_count} unreturned book${active_count > 1 ? "s" : ""} — resolve before deactivating`
    );
  }

  await db.query(
    "UPDATE users SET is_active = 0, deleted_at = NOW(), deleted_by = ? WHERE student_employee_id = ?",
    [requesterId, student_employee_id]
  );
  return { message: "User deactivated successfully" };
}

// RESTORE USER
async function restoreUser(student_employee_id, requesterRole) {
  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NOT NULL",
    [student_employee_id]
  );
  if (!existing.length) throw new Error("Archived user not found");

  const user = existing[0];

  if (!roleHierarchy[requesterRole]?.includes(user.role)) {
    throw new Error("You are not allowed to restore this user");
  }

  await db.query(
    "UPDATE users SET deleted_at = NULL, deleted_by = NULL, is_active = 1 WHERE student_employee_id = ?",
    [student_employee_id]
  );
  return { message: "User restored successfully" };
}

// UPDATE USER
async function updateUser(student_employee_id, updates, requesterRole) {
  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ? AND deleted_at IS NULL",
    [student_employee_id]
  );
  if (!existing.length) throw new Error("User not found");

  const targetRole = existing[0].role;
  if (!roleHierarchy[requesterRole]?.includes(targetRole)) {
    throw new Error("You are not allowed to update this user");
  }

  const fields = [];
  const values = [];

  if (updates.name) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (updates.role) {
    if (!roleHierarchy[requesterRole]?.includes(updates.role)) {
      throw new Error("You are not allowed to assign this role");
    }
    if (updates.role === requesterRole) {
      throw new Error("You cannot assign your own role");
    }
    fields.push("role = ?");
    values.push(updates.role);
  }

  if (updates.password) {
    const password_hash = await bcrypt.hash(updates.password, 12);
    fields.push("password_hash = ?");
    values.push(password_hash);
    fields.push("must_change_password = 1");
  }

  if (updates.address !== undefined) {
    fields.push("address = ?");
    values.push(updates.address);
  }

  if (updates.contact !== undefined) {
    fields.push("contact = ?");
    values.push(updates.contact);
  }

  if (updates.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }

  if (!fields.length) throw new Error("No valid fields to update");

  values.push(student_employee_id);

  await db.query(
    `UPDATE users SET ${fields.join(", ")} WHERE student_employee_id = ? AND deleted_at IS NULL`,
    values
  );

  return { message: "User updated successfully" };
}

// SEARCH USERS
async function searchUsers(query, requesterRole) {
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) {
    throw new Error("You are not allowed to search users");
  }

  const showArchived = query.archived === "true";
  let sql = `SELECT student_employee_id, name, role, is_active, address, contact, deleted_at
             FROM users WHERE deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}`;
  const values = [...allowedRoles];

  sql += ` AND role IN (${allowedRoles.map(() => "?").join(", ")})`;

  if (query.student_employee_id && query.name) {
    sql += " AND (student_employee_id = ? OR name LIKE ?)";
    values.push(query.student_employee_id, `%${query.name}%`);
  } else {
    if (query.student_employee_id) {
      sql += " AND student_employee_id = ?";
      values.push(query.student_employee_id);
    }
    if (query.name) {
      sql += " AND name LIKE ?";
      values.push(`%${query.name}%`);
    }
  }

  if (query.role) {
    if (!allowedRoles.includes(query.role)) {
      return [];
    }
    sql += " AND role = ?";
    values.push(query.role);
  }

  const [results] = await db.query(sql, values);
  return results;
}

async function queryToolsSearch(term, requesterRole) {
  const query = term?.trim();
  if (!query) {
    throw new Error("Search term is required");
  }

  const like = `%${query}%`;
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) {
    throw new Error("You are not allowed to search query tools");
  }

  const [users, books, borrowings, reservations, notifications] = await Promise.all([
    db.query(
      `SELECT id, student_employee_id, name, role, is_active
       FROM users
       WHERE deleted_at IS NULL
         AND role IN (${allowedRoles.map(() => "?").join(", ")})
         AND (
           student_employee_id LIKE ?
           OR name LIKE ?
           OR barcode LIKE ?
         )
       ORDER BY name ASC
       LIMIT 10`,
      [...allowedRoles, like, like, like]
    ),
    db.query(
      `SELECT id, title, author, isbn, category, copies, location
       FROM books
       WHERE deleted_at IS NULL
         AND (
           title LIKE ?
           OR author LIKE ?
           OR isbn LIKE ?
         )
       ORDER BY title ASC
       LIMIT 10`,
      [like, like, like]
    ),
    db.query(
      `SELECT
         b.id,
         b.status,
         b.borrowed_at,
         b.due_date,
         b.returned_at,
         u.name AS user_name,
         u.student_employee_id,
         bk.title AS book_title,
         bc.barcode AS copy_barcode
       FROM borrowings b
       JOIN users u ON u.id = b.user_id
       JOIN books bk ON bk.id = b.book_id
       LEFT JOIN book_copies bc ON bc.id = b.copy_id
       WHERE b.deleted_at IS NULL
         AND (
           u.student_employee_id LIKE ?
           OR u.name LIKE ?
           OR bk.title LIKE ?
           OR bk.isbn LIKE ?
           OR bc.barcode LIKE ?
           OR CAST(b.id AS CHAR) LIKE ?
         )
       ORDER BY b.borrowed_at DESC
       LIMIT 10`,
      [like, like, like, like, like, like]
    ),
    db.query(
      `SELECT
         r.id,
         r.status,
         r.reserved_at,
         r.expires_at,
         u.name AS user_name,
         u.student_employee_id,
         bk.title AS book_title
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       JOIN books bk ON bk.id = r.book_id
       WHERE r.deleted_at IS NULL
         AND (
           u.student_employee_id LIKE ?
           OR u.name LIKE ?
           OR bk.title LIKE ?
           OR CAST(r.id AS CHAR) LIKE ?
         )
       ORDER BY r.reserved_at DESC
       LIMIT 10`,
      [like, like, like, like]
    ),
    db.query(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.created_at,
         n.audience_type,
         n.audience_role
       FROM notifications n
       WHERE n.title LIKE ?
          OR n.body LIKE ?
          OR n.type LIKE ?
          OR CAST(n.id AS CHAR) LIKE ?
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [like, like, like, like]
    ),
  ]);

  return {
    users: users[0],
    books: books[0],
    borrowings: borrowings[0],
    reservations: reservations[0],
    notifications: notifications[0],
  };
}

async function bulkDeactivateStudentLikeUsers(requesterRole, requesterId) {
  if (!["admin", "super_admin"].includes(requesterRole)) {
    throw new Error("You are not allowed to bulk deactivate users");
  }

  const [users] = await db.query(
    `SELECT
       u.id,
       u.student_employee_id,
       u.role,
       COUNT(CASE WHEN b.status IN ('borrowed', 'overdue') THEN 1 END) AS active_borrow_count
     FROM users u
     LEFT JOIN borrowings b ON b.user_id = u.id AND b.deleted_at IS NULL
     WHERE u.deleted_at IS NULL
       AND u.is_active = 1
       AND u.role IN (${STUDENT_LIKE_ROLES.map(() => "?").join(", ")})
     GROUP BY u.id, u.student_employee_id, u.role`,
    STUDENT_LIKE_ROLES
  );

  const eligibleUsers = users.filter((user) => Number(user.active_borrow_count) === 0);
  const skippedUsers = users.filter((user) => Number(user.active_borrow_count) > 0);

  if (eligibleUsers.length) {
    await db.query(
      `UPDATE users
       SET is_active = 0,
           deleted_at = NOW(),
           deleted_by = ?
       WHERE deleted_at IS NULL
         AND is_active = 1
         AND role IN (${STUDENT_LIKE_ROLES.map(() => "?").join(", ")})
         AND id IN (${eligibleUsers.map(() => "?").join(", ")})`,
      [requesterId, ...STUDENT_LIKE_ROLES, ...eligibleUsers.map((user) => user.id)]
    );
  }

  return {
    message: skippedUsers.length
      ? `Deactivated ${eligibleUsers.length} account${eligibleUsers.length === 1 ? "" : "s"}. Skipped ${skippedUsers.length} account${skippedUsers.length === 1 ? "" : "s"} with unreturned books.`
      : `Deactivated ${eligibleUsers.length} student-like account${eligibleUsers.length === 1 ? "" : "s"}.`,
    deactivated_count: eligibleUsers.length,
    skipped_count: skippedUsers.length,
    skipped_users: skippedUsers.map((user) => ({
      student_employee_id: user.student_employee_id,
      role: user.role,
      active_borrow_count: Number(user.active_borrow_count),
    })),
  };
}

module.exports = {
  createUser,
  deleteUser,
  restoreUser,
  updateUser,
  searchUsers,
  queryToolsSearch,
  bulkDeactivateStudentLikeUsers,
};
