const bcrypt = require("bcryptjs");
const qr = require("qrcode");
const repository = require("./admin.repository");
const { revokeAllRefreshSessionsForUser } = require("../auth/authSession.service");

const STUDENT_LIKE_ROLES = ["student", "employee", "alumni"];
const roleHierarchy = {
  super_admin: ["admin", "staff", "scanner", "employee", "alumni", "student"],
  admin: ["staff", "scanner", "employee", "alumni", "student"],
  staff: ["scanner", "employee", "alumni", "student"],
};
const searchRoleHierarchy = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "employee", "alumni", "student"],
  admin: ["admin", "staff", "scanner", "employee", "alumni", "student"],
  staff: ["employee", "alumni", "student"],
};

async function ensureProgramExists(programId) {
  if (!programId) return null;
  const program = await repository.findActiveProgram(programId);
  if (!program) throw new Error("Select a valid active program / course");
  return program.id;
}

async function createUser({ student_employee_id, name, role, password, address, contact, program_id, academic_term_id }, creatorRole) {
  if (!roleHierarchy[creatorRole]?.includes(role)) throw new Error("You are not allowed to create a user with this role");
  if (role === creatorRole && creatorRole !== "super_admin") throw new Error("You cannot create a user with your own role");
  if ((await repository.findExistingUser(student_employee_id)).length) throw new Error("User already exists");
  const password_hash = await bcrypt.hash(password, 12);
  const programId = await ensureProgramExists(program_id);
  let academicTermId = null;
  if (role === "student") {
    if (academic_term_id) {
      const term = await repository.findAcademicTerm(academic_term_id);
      if (!term) throw new Error("Select a valid academic term");
      academicTermId = term.id;
    } else {
      academicTermId = (await repository.findCurrentAcademicTerm())?.id ?? null;
    }
  }
  const barcode = await repository.createUser({ studentEmployeeId: student_employee_id, name, passwordHash: password_hash, role, address, contact, programId, academicTermId });
  return { message: "User created successfully", barcode };
}

async function deleteUser(student_employee_id, requesterRole, requesterId) {
  const conn = await repository.getConnection();
  let user;
  try {
    await conn.beginTransaction();
    user = await repository.findUserForUpdate(student_employee_id, conn);
    if (!user) throw new Error("User not found");
    if (!roleHierarchy[requesterRole]?.includes(user.role)) throw new Error("You are not allowed to deactivate this user");
    if (!user.is_active) throw new Error("User is already deactivated");
    const activeBorrows = await repository.findActiveBorrowings(user.id, conn);
    if (activeBorrows.length) throw new Error(`User has ${activeBorrows.length} unreturned book${activeBorrows.length > 1 ? "s" : ""} — resolve before deactivating`);
    const activeReservations = await repository.findActiveReservations(user.id, conn);
    if (activeReservations.length) throw new Error(`User has ${activeReservations.length} active reservation${activeReservations.length > 1 ? "s" : ""} — resolve before deactivating`);
    await repository.deactivateUser(user.id, requesterId, conn);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  await revokeAllRefreshSessionsForUser(user.id);
  return { message: "User deactivated successfully" };
}

async function restoreUser(student_employee_id, requesterRole) {
  const user = await repository.findArchivedUser(student_employee_id);
  if (!user) throw new Error("Archived user not found");
  if (!roleHierarchy[requesterRole]?.includes(user.role)) throw new Error("You are not allowed to restore this user");
  await repository.restoreUser(student_employee_id);
  return { message: "User restored successfully" };
}

async function updateUser(student_employee_id, updates, requesterRole) {
  const existing = await repository.findActiveUser(student_employee_id);
  if (!existing) throw new Error("User not found");
  if (!roleHierarchy[requesterRole]?.includes(existing.role)) throw new Error("You are not allowed to update this user");
  const normalized = {};
  if (updates.name) normalized.name = updates.name;
  if (updates.role) {
    if (!roleHierarchy[requesterRole]?.includes(updates.role)) throw new Error("You are not allowed to assign this role");
    if (updates.role === requesterRole) throw new Error("You cannot assign your own role");
    normalized.role = updates.role;
  }
  if (updates.password) {
    normalized.password_hash = await bcrypt.hash(updates.password, 12);
    normalized.must_change_password = 1;
  }
  if (updates.address !== undefined) normalized.address = updates.address;
  if (updates.contact !== undefined) normalized.contact = updates.contact;
  if (updates.program_id !== undefined) normalized.program_id = await ensureProgramExists(updates.program_id);
  if (updates.academic_term_id !== undefined) {
    const term = updates.academic_term_id ? await repository.findAcademicTerm(updates.academic_term_id) : null;
    if (updates.academic_term_id && !term) throw new Error("Select a valid academic term");
    normalized.academic_term_id = term?.id ?? null;
  }
  if (updates.is_active !== undefined) normalized.is_active = updates.is_active ? 1 : 0;
  if (!Object.keys(normalized).length) throw new Error("No valid fields to update");
  await repository.updateUser(student_employee_id, normalized);
  return { message: "User updated successfully" };
}

async function searchUsers(query, requesterRole) {
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) throw new Error("You are not allowed to search users");
  const showArchived = query.archived === "true";
  if (query.role && !allowedRoles.includes(query.role)) {
    if (query.page !== undefined) return { rows: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } };
    return [];
  }
  const result = await repository.searchUsers({
    allowedRoles,
    showArchived,
    studentEmployeeId: query.student_employee_id,
    name: query.name,
    role: query.role,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
  if (query.page === undefined) return result;
  return { rows: result.rows, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) } };
}

async function queryToolsSearch(term, requesterRole) {
  const query = term?.trim();
  if (!query) throw new Error("Search term is required");
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) throw new Error("You are not allowed to search query tools");
  return repository.queryToolsSearch(query, allowedRoles);
}

async function bulkDeactivateStudentLikeUsers(requesterRole, requesterId) {
  if (!["admin", "super_admin"].includes(requesterRole)) throw new Error("You are not allowed to bulk deactivate users");
  const users = await repository.findStudentLikeUsers();
  const eligibleUsers = users.filter((user) => Number(user.active_borrow_count) === 0);
  const skippedUsers = users.filter((user) => Number(user.active_borrow_count) > 0);
  await repository.bulkDeactivateUserIds(eligibleUsers.map((user) => user.id), requesterId);
  return {
    message: skippedUsers.length
      ? `Deactivated ${eligibleUsers.length} account${eligibleUsers.length === 1 ? "" : "s"}. Skipped ${skippedUsers.length} account${skippedUsers.length === 1 ? "" : "s"} with unreturned books.`
      : `Deactivated ${eligibleUsers.length} student-like account${eligibleUsers.length === 1 ? "" : "s"}.`,
    deactivated_count: eligibleUsers.length,
    skipped_count: skippedUsers.length,
    skipped_users: skippedUsers.map((user) => ({ student_employee_id: user.student_employee_id, role: user.role, active_borrow_count: Number(user.active_borrow_count) })),
  };
}

module.exports = { createUser, deleteUser, restoreUser, updateUser, searchUsers, queryToolsSearch, bulkDeactivateStudentLikeUsers };
