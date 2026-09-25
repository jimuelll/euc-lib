const bcrypt = require("bcryptjs");
const qr = require("qrcode");
const repository = require("./admin.repository");
const { revokeAllRefreshSessionsForUser } = require("../auth/authSession.service");
const fineLedger = require("../borrowing/fine-ledger.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");

const ACADEMIC_ROLES = ["student", "staff", "alumni"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"];
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

const conflict = (message) => Object.assign(new Error(message), { status: 409 });
const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

async function assertUserHasNoOutstandingFines(userId, conn) {
  const borrowingIds = await repository.findAllBorrowingIdsForUser(userId, conn);
  return fineLedger.assertNoOutstandingFines(borrowingIds, conn, "This patron cannot be archived");
}

async function ensureProgramExists(programId, conn) {
  if (!programId) return null;
  const program = await repository.findActiveProgram(programId, conn);
  if (!program) throw new Error("Select a valid active program / course");
  return program.id;
}

async function ensureDepartmentExists(departmentId, conn) {
  if (!departmentId) return null;
  const department = await repository.findActiveDepartment(departmentId, conn);
  if (!department) throw new Error("Select a valid active department");
  return department.id;
}

function roleProfile(input, role) {
  const value = (key) => String(input[key] || "").trim();
  const libraryCardNumber = value("library_card_number");
  const studentNumber = value("student_number");
  const employeeNumber = value("employee_number");
  const username = value("username");
  if (ACADEMIC_ROLES.includes(role)) {
    if (!libraryCardNumber) throw new Error("Library Card Number is required");
    if (role !== "alumni" && !studentNumber) throw new Error("Student No. is required");
    if (role !== "alumni" && !input.program_id) throw new Error("Course is required");
    if (role !== "alumni" && !YEAR_LEVELS.includes(value("year_level"))) throw new Error("Select a valid Year Level");
    return { studentEmployeeId: libraryCardNumber, libraryCardNumber, studentNumber: studentNumber || null, employeeNumber: null, username: null };
  }
  if (role === "employee") {
    if (!employeeNumber) throw new Error("Employee No. is required");
    if (!input.department_id) throw new Error("Department is required");
    return { studentEmployeeId: employeeNumber, libraryCardNumber: null, studentNumber: null, employeeNumber, username: null };
  }
  if (!username) throw new Error("Username is required");
  return { studentEmployeeId: username, libraryCardNumber: null, studentNumber: null, employeeNumber: null, username };
}

async function createUser(input, creatorRole, creatorId = null) {
  const { name, role, password, address, contact, program_id, academic_term_id, department_id, year_level, email } = input;
  if (!roleHierarchy[creatorRole]?.includes(role)) throw new Error("You are not allowed to create a user with this role");
  if (role === creatorRole && creatorRole !== "super_admin") throw new Error("You cannot create a user with your own role");
  if (!String(name || "").trim() || !password) throw new Error("Name and password are required");
  const identity = roleProfile(input, role);
  const password_hash = await bcrypt.hash(password, 12);
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if ((await repository.findExistingUser(identity.studentEmployeeId, conn)).length) throw Object.assign(new Error("User already exists"), { status: 409 });
    const programId = ACADEMIC_ROLES.includes(role) && role !== "alumni" ? await ensureProgramExists(program_id, conn) : null;
    const departmentId = role === "employee" ? await ensureDepartmentExists(department_id, conn) : null;
    let academicTermId = null;
    if (role === "student") {
      if (academic_term_id) {
        const term = await repository.findAcademicTerm(academic_term_id, conn);
        if (!term) throw new Error("Select a valid academic term");
        academicTermId = term.id;
      } else {
        academicTermId = (await repository.findCurrentAcademicTerm(conn))?.id ?? null;
      }
    }
    const barcode = await repository.createUser({ ...identity, email, name: name.trim(), passwordHash: password_hash, role, address, contact, programId, academicTermId, yearLevel: ACADEMIC_ROLES.includes(role) && role !== "alumni" ? year_level : null, departmentId, remarks: null }, conn);
    const [[created]] = await conn.query(
      `SELECT id, name, student_employee_id, email, role, is_active, program_id, academic_term_id,
              department_id, address, contact, year_level, remarks, deleted_at
         FROM users WHERE barcode = ? LIMIT 1`,
      [barcode],
    );
    await enqueueTransactionalAudit(conn, {
      actorId: creatorId,
      category: "users",
      route: "/api/admin/users",
      action: "created",
      description: "Created user account",
      before: null,
      after: created,
      isCreation: true,
    });
    await conn.commit();
    return { message: "User created successfully", barcode };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

async function deleteUser(student_employee_id, requesterRole, requesterId) {
  const conn = await repository.getConnection();
  let user;
  try {
    await conn.beginTransaction();
    user = await repository.findUserForUpdate(student_employee_id, conn);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!roleHierarchy[requesterRole]?.includes(user.role)) throw forbidden("You are not allowed to archive this user");
    if (!user.is_active) throw conflict("User is already deactivated");
    await assertUserHasNoOutstandingFines(user.id, conn);
    const activeBorrows = await repository.findActiveBorrowings(user.id, conn);
    if (activeBorrows.length) throw conflict(`User has ${activeBorrows.length} unreturned book${activeBorrows.length > 1 ? "s" : ""} — resolve before archiving`);
    const activeReservations = await repository.findActiveReservations(user.id, conn);
    if (activeReservations.length) throw conflict(`User has ${activeReservations.length} active reservation${activeReservations.length > 1 ? "s" : ""} — resolve before archiving`);
    await repository.deactivateUser(user.id, requesterId, conn);
    const after = await repository.findUserByIdForAudit(user.id, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: requesterId,
      category: "users",
      route: `/api/admin/users/${encodeURIComponent(student_employee_id)}`,
      action: "archived",
      description: "Archived user account",
      before: user,
      after,
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  try { await revokeAllRefreshSessionsForUser(user.id); }
  catch (error) { console.error("[admin] User archival committed; refresh-session revocation failed:", error); }
  return { message: "User archived successfully" };
}

async function restoreUser(student_employee_id, requesterRole, requesterId = null) {
  const conn = await repository.getConnection();
  let user;
  try {
    await conn.beginTransaction();
    user = await repository.findArchivedUser(student_employee_id, conn);
    if (!user) throw Object.assign(new Error("Archived user not found"), { status: 404 });
    if (!roleHierarchy[requesterRole]?.includes(user.role)) throw forbidden("You are not allowed to restore this user");
    const changed = await repository.restoreUser(student_employee_id, conn);
    if (changed !== 1) throw conflict("This account changed while it was being restored. Reload and try again.");
    const after = await repository.findUserByIdForAudit(user.id, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: requesterId,
      category: "users",
      route: `/api/admin/users/${encodeURIComponent(student_employee_id)}/restore`,
      action: "restored",
      description: "Restored user account",
      before: { is_active: 0, deleted_at: "archived" },
      after,
      type: "state_transition",
      details: { stateFrom: "Archived", stateTo: "Unarchived", stateLabel: "Archive state" },
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
  return { message: "User restored successfully" };
}

async function updateUser(student_employee_id, updates, requesterRole, requesterId = null) {
  const passwordHash = updates.password ? await bcrypt.hash(updates.password, 12) : null;
  const conn = await repository.getConnection();
  let deactivatedUserId = null;
  try {
    await conn.beginTransaction();
    const existing = await repository.findUserForUpdate(student_employee_id, conn);
    if (!existing) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!roleHierarchy[requesterRole]?.includes(existing.role)) throw forbidden("You are not allowed to update this user");
    const normalized = {};
    const nextRole = updates.role || existing.role;
    if (updates.name) normalized.name = updates.name;
    if (updates.role) {
      if (!roleHierarchy[requesterRole]?.includes(updates.role)) throw forbidden("You are not allowed to assign this role");
      if (updates.role === requesterRole) throw forbidden("You cannot assign a user with your own role");
      normalized.role = updates.role;
    }
    if (passwordHash) { normalized.password_hash = passwordHash; normalized.must_change_password = 1; }
    const identityKeys = ["library_card_number", "student_number", "employee_number", "username", "program_id", "department_id", "year_level"];
    if (identityKeys.some((key) => updates[key] !== undefined) || updates.role) {
      const profile = roleProfile({ ...existing, ...updates }, nextRole);
      Object.assign(normalized, { student_employee_id: profile.studentEmployeeId, library_card_number: profile.libraryCardNumber, student_number: profile.studentNumber, employee_number: profile.employeeNumber, username: profile.username });
      normalized.program_id = ACADEMIC_ROLES.includes(nextRole) && nextRole !== "alumni" ? await ensureProgramExists(updates.program_id ?? existing.program_id, conn) : null;
      normalized.department_id = nextRole === "employee" ? await ensureDepartmentExists(updates.department_id ?? existing.department_id, conn) : null;
      normalized.year_level = ACADEMIC_ROLES.includes(nextRole) && nextRole !== "alumni" ? (updates.year_level ?? existing.year_level) : null;
    }
    if (updates.email !== undefined) normalized.email = updates.email || null;
    if (updates.address !== undefined) normalized.address = updates.address;
    if (updates.contact !== undefined) normalized.contact = updates.contact;
    if (updates.remarks !== undefined && nextRole === "student") normalized.remarks = updates.remarks || null;
    if (updates.academic_term_id !== undefined) {
      const term = updates.academic_term_id ? await repository.findAcademicTerm(updates.academic_term_id, conn) : null;
      if (updates.academic_term_id && !term) throw new Error("Select a valid academic term");
      normalized.academic_term_id = term?.id ?? null;
    }
    if (updates.is_active !== undefined) normalized.is_active = updates.is_active ? 1 : 0;
    if (!Object.keys(normalized).length) throw new Error("No valid fields to update");

    if (normalized.is_active === 0) {
      await assertUserHasNoOutstandingFines(existing.id, conn);
      const activeBorrows = await repository.findActiveBorrowings(existing.id, conn);
      if (activeBorrows.length) throw conflict(`User has ${activeBorrows.length} unreturned book${activeBorrows.length > 1 ? "s" : ""} — resolve before deactivating`);
      const activeReservations = await repository.findActiveReservations(existing.id, conn);
      if (activeReservations.length) throw conflict(`User has ${activeReservations.length} active reservation${activeReservations.length > 1 ? "s" : ""} — resolve before deactivating`);
      deactivatedUserId = existing.id;
    }
    await repository.updateUser(student_employee_id, normalized, conn);
    const after = await repository.findUserByIdForAudit(existing.id, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: requesterId,
      category: "users",
      route: `/api/admin/users/${encodeURIComponent(student_employee_id)}`,
      description: normalized.is_active === 0 ? "Deactivated user account" : "Updated user account",
      before: existing,
      after,
      extraMetadata: updates.password ? { security_change: "Password value withheld; password changed" } : {},
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY") throw Object.assign(new Error("That user identifier or email is already in use"), { status: 409 });
    throw error;
  } finally { conn.release(); }

  if (deactivatedUserId) {
    try { await revokeAllRefreshSessionsForUser(deactivatedUserId); }
    catch (error) { console.error("[admin] User deactivation committed; refresh-session revocation failed:", error); }
  }
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

module.exports = { createUser, deleteUser, restoreUser, updateUser, searchUsers, queryToolsSearch };
