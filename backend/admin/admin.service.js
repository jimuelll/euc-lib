const bcrypt = require("bcryptjs");
const db = require("../db");

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
    "SELECT * FROM users WHERE student_employee_id = ?",
    [student_employee_id]
  );
  if (existing.length) {
    throw new Error("User already exists");
  }

  const password_hash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO users 
      (student_employee_id, name, password_hash, role, is_active, must_change_password, address, contact)
      VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
    [student_employee_id, name, password_hash, role, address || null, contact || null]
  );

  return { message: "User created successfully" };
}

// DELETE USER
async function deleteUser(student_employee_id, requesterRole) {
  // Get user to delete
  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ?",
    [student_employee_id]
  );
  if (!existing.length) throw new Error("User not found");

  const targetRole = existing[0].role;
  if (!roleHierarchy[requesterRole]?.includes(targetRole)) {
    throw new Error("You are not allowed to delete this user");
  }

  await db.query("DELETE FROM users WHERE student_employee_id = ?", [student_employee_id]);
  return { message: "User deleted successfully" };
}

// UPDATE USER
async function updateUser(student_employee_id, updates, requesterRole) {
  const [existing] = await db.query(
    "SELECT * FROM users WHERE student_employee_id = ?",
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
    fields.push("must_change_password = 1"); // force password change for next login
  }

  if (updates.address !== undefined) {
  fields.push("address = ?");
  values.push(updates.address);
}

  if (updates.contact !== undefined) {
    fields.push("contact = ?");
    values.push(updates.contact);
  }

  if (!fields.length) throw new Error("No valid fields to update");

  values.push(student_employee_id);

  await db.query(`UPDATE users SET ${fields.join(", ")} WHERE student_employee_id = ?`, values);

  return { message: "User updated successfully" };
}

// SEARCH USERS
async function searchUsers(query) {
  let sql = "SELECT student_employee_id, name, role, is_active, address, contact FROM users WHERE 1=1";
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

module.exports = { createUser, deleteUser, updateUser, searchUsers };