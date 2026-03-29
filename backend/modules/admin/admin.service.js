const bcrypt = require("bcryptjs");
const db = require("../../db");
const qr = require("qrcode");

// Role hierarchy map
const roleHierarchy = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "student"],
  admin: ["admin", "staff", "scanner", "student"],
  staff: ["staff", "scanner", "student"],
};

// CREATE USER
async function createUser({ student_employee_id, name, role, password, address, contact }, creatorRole) {
  if (!roleHierarchy[creatorRole]?.includes(role)) {
    throw new Error("You are not allowed to create a user with this role");
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
async function searchUsers(query) {
  const showArchived = query.archived === "true";
  let sql = `SELECT student_employee_id, name, role, is_active, address, contact, deleted_at
             FROM users WHERE deleted_at IS ${showArchived ? "NOT NULL" : "NULL"}`;
  const values = [];

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
    sql += " AND role = ?";
    values.push(query.role);
  }

  const [results] = await db.query(sql, values);
  return results;
}

module.exports = { createUser, deleteUser, restoreUser, updateUser, searchUsers };