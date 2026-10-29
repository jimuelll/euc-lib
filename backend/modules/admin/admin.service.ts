import * as accountRepository from "./admin.account.repository";
import bcrypt = require("bcryptjs");
import { randomBytes } from "node:crypto";
import * as accountEmail from "../auth/account-email.service";
import { normalizeEmail } from "../email/email.config";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import repository = require("./admin.repository");
import type { AdminRole, UserProfile, UserSearchQuery } from "./admin.types";
const { revokeAllRefreshSessionsForUser } = require("../auth/authSession.service") as { revokeAllRefreshSessionsForUser: (userId: number) => Promise<void> };
const fineLedger = require("../borrowing/fine-ledger.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit") as {
  enqueueTransactionalAudit: (conn: PoolConnection, entry: Record<string, unknown>) => Promise<void>;
};
import { isOperationsRole } from "../auth/operations-access";
const ACADEMIC_ROLES = ["student", "alumni"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Other"];
const roleHierarchy: Record<string, string[]> = {
  super_admin: ["admin", "staff", "scanner", "opac", "employee", "alumni", "student"],
  admin: ["staff", "scanner", "opac", "employee", "alumni", "student"],
  staff: ["employee", "alumni", "student"],
};
const searchRoleHierarchy: Record<string, string[]> = {
  super_admin: ["super_admin", "admin", "staff", "scanner", "opac", "employee", "alumni", "student"],
  admin: ["admin", "staff", "scanner", "opac", "employee", "alumni", "student"],
  staff: ["employee", "alumni", "student"],
};
interface ServiceError extends Error {
  status?: number;
  outstandingAmount?: number;
  affectedLoans?: number;
}
interface DatabaseError extends Error {
  code?: string;
}
type UserInput = Record<string, unknown>;
const conflict = (message: string): ServiceError => Object.assign(new Error(message), { status: 409 });
const forbidden = (message: string): ServiceError => Object.assign(new Error(message), { status: 403 });
const hasDuplicateKeyError = (error: unknown): boolean => (error as DatabaseError | null)?.code === "ER_DUP_ENTRY";
const assertUserHasNoOutstandingFines = async (userId: number, conn: PoolConnection): Promise<void> => {
  const borrowingIds = await repository.findAllBorrowingIdsForUser(userId, conn);
  await fineLedger.assertNoOutstandingFines(borrowingIds, conn, "This patron cannot be archived");
};
const ensureProgramExists = async (programId: unknown, conn: PoolConnection): Promise<number | null> => {
  if (!programId) return null;
  const program = await repository.findActiveProgram(programId as number | string, conn);
  if (!program) throw new Error("Select a valid active program / course");
  return program.id;
};
const ensureDepartmentExists = async (departmentId: unknown, conn: PoolConnection): Promise<number | null> => {
  if (!departmentId) return null;
  const department = await repository.findActiveDepartment(departmentId as number | string, conn);
  if (!department) throw new Error("Select a valid active department");
  return department.id;
};
const roleProfile = (input: UserInput, role: string): UserProfile => {
  const value = (key: string): string => String(input[key] || "").trim();
  const libraryCardNumber = value("library_card_number");
  const studentNumber = value("student_number");
  const employeeNumber = value("employee_number");
  const username = value("username") || (role === "staff" ? value("library_card_number") : "");
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
};
const createUser = async (input: UserInput, creatorRole: string, creatorId: number | null = null) => {
  const { name, role: requestedRole, address, contact, program_id, academic_term_id, department_id, year_level, email } = input;
  const role = String(requestedRole || "");
  if (!(creatorRole === "super_admin" && role === "super_admin") && !roleHierarchy[creatorRole]?.includes(role)) throw forbidden("You are not allowed to create a user with this role");
  if (role === creatorRole && creatorRole !== "super_admin") throw new Error("You cannot create a user with your own role");
  if (!isOperationsRole(role) && Object.prototype.hasOwnProperty.call(input,"password")) throw new Error("Staff cannot choose passwords. Use account email actions.");
  if (!String(name || "").trim()) throw new Error("Name is required");
  const operations = isOperationsRole(role);
  if (operations && email) throw new Error("Library Operations accounts do not use email");
  const accountAddress = operations ? null : normalizeEmail(email);
  const identity = roleProfile(input, role);
  const passwordHash = await bcrypt.hash(operations ? accountEmail.validatePassword(input.password) : randomBytes(48).toString("base64url"), 12);
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if ((await repository.findExistingUser(identity.studentEmployeeId, conn)).length) throw Object.assign(new Error("User already exists"), { status: 409, fieldErrors: { [role === "student" || role === "alumni" ? "libraryCardNumber" : role === "employee" ? "employeeNumber" : "username"]: "This identifier already belongs to another user." } });
    const programId = ACADEMIC_ROLES.includes(role) && role !== "alumni" ? await ensureProgramExists(program_id, conn) : null;
    const departmentId = role === "employee" ? await ensureDepartmentExists(department_id, conn) : null;
    let academicTermId: number | null = null;
    if (role === "student") {
      if (academic_term_id) {
        const term = await repository.findAcademicTerm(academic_term_id as string | number, conn);
        if (!term) throw new Error("Select a valid academic term");
        academicTermId = term.id;
      } else {
        academicTermId = (await repository.findCurrentAcademicTerm(conn))?.id ?? null;
      }
    }
    if (role === "student" && !academicTermId) throw Object.assign(new Error("Select an academic term"), {fieldErrors:{academicTermId:"Select an academic term."}});
    const barcode = await repository.createUser({
      ...identity,
      email: accountAddress,
      name: String(name).trim(),
      passwordHash,
      role,
      address,
      contact,
      programId,
      academicTermId,
      yearLevel: ACADEMIC_ROLES.includes(role) && role !== "alumni" ? year_level as string : null,
      departmentId,
      remarks: input.remarks ? String(input.remarks) : null,
    }, conn);
    const [createdRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, name, student_employee_id, email, role, is_active, program_id, academic_term_id,
              department_id, address, contact, year_level, remarks, deleted_at
         FROM users WHERE barcode = ? LIMIT 1`,
      [barcode],
    );
    if (!createdRows[0] || createdRows[0].role !== role) {
      throw Object.assign(new Error("The database did not save the requested account role. Apply the latest role migration before creating this account."), { status: 503 });
    }
    if (!operations) await accountEmail.invite(conn, createdRows[0]);
    await enqueueTransactionalAudit(conn, {
      actorId: creatorId,
      category: "users",
      route: "/api/admin/users",
      action: "created",
      description: "Created user account",
      before: null,
      after: createdRows[0],
      isCreation: true,
    });
    await conn.commit();
    return { message: operations ? "Library Operations account created. Ready to sign in." : "Account created; invitation queued. Creation recorded in the audit log.", barcode };
  } catch (error) {
    await conn.rollback();
    throw userFieldError(error, role);
  } finally { conn.release(); }
};
const deleteUser = async (student_employee_id: string, requesterRole: string, requesterId: number, reason = "") => {
  if (!reason.trim() || reason.trim().length > 500) throw Object.assign(new Error("Enter an archive reason (up to 500 characters)."), {status:400});
  const conn = await repository.getConnection();
  let archivedUserId = 0;
  try {
    await conn.beginTransaction();
    const user = await repository.findUserForUpdate(student_employee_id, conn);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!roleHierarchy[requesterRole]?.includes(user.role)) throw forbidden("You are not allowed to archive this user");
    if (!user.is_active) throw conflict("User is already deactivated");
    await assertUserHasNoOutstandingFines(user.id, conn);
    const activeBorrows = await repository.findActiveBorrowings(user.id, conn);
    if (activeBorrows.length) throw conflict(`User has ${activeBorrows.length} unreturned book${activeBorrows.length > 1 ? "s" : ""} — resolve before archiving`);
    const activeReservations = await repository.findActiveReservations(user.id, conn);
    if (activeReservations.length) throw conflict(`User has ${activeReservations.length} active reservation${activeReservations.length > 1 ? "s" : ""} — resolve before archiving`);
    archivedUserId = user.id;
    await repository.deactivateUser(user.id, requesterId, conn);
    await accountEmail.invalidateChallenges(conn,user.id);
    await conn.query("DELETE FROM email_address_claims WHERE user_id=?",[user.id]);
    const after = await repository.findUserByIdForAudit(user.id, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: requesterId,
      category: "users",
      route: `/api/admin/users/${encodeURIComponent(student_employee_id)}`,
      action: "archived",
      description: "Archived user account",
      extraMetadata: { archive_reason: reason.trim() },
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
  try { await revokeAllRefreshSessionsForUser(archivedUserId); }
  catch (error) { console.error("[admin] User archival committed; refresh-session revocation failed:", error); }
  return { message: "User archived successfully" };
};
const restoreUser = async (student_employee_id: string, requesterRole: string, requesterId: number | null = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const user = await repository.findArchivedUser(student_employee_id, conn);
    if (!user) throw Object.assign(new Error("Archived user not found"), { status: 404 });
    if (!roleHierarchy[requesterRole]?.includes(user.role)) throw forbidden("You are not allowed to restore this user");
    if (user.email) await accountEmail.claimAddress(conn,user.id,String(user.email));
    if (user.pending_email) await accountEmail.claimAddress(conn,user.id,String(user.pending_email));
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
};
const updateUser = async (student_employee_id: string, updates: UserInput, requesterRole: string, requesterId: number | null = null) => {
  if (Object.prototype.hasOwnProperty.call(updates,"password")) throw new Error("Staff cannot choose passwords. Use account email actions.");
  const conn = await repository.getConnection();
  let deactivatedUserId: number | null = null;
  let roleChangedUserId: number | null = null;
  try {
    await conn.beginTransaction();
    const existing = await repository.findUserForUpdate(student_employee_id, conn);
    if (!existing) throw Object.assign(new Error("User not found"), { status: 404 });
    if (existing.id === requesterId && updates.role !== undefined && updates.role !== existing.role) throw forbidden("You can’t change your own role.");
    const isOwnSuperAdmin = requesterRole === "super_admin" && existing.role === "super_admin" && existing.id === requesterId;
    const isUnverifiedSuperAdmin = requesterRole === "super_admin" && existing.role === "super_admin" && !existing.email_verified_at;
    if (!isOwnSuperAdmin && !isUnverifiedSuperAdmin && !roleHierarchy[requesterRole]?.includes(existing.role)) throw forbidden("You are not allowed to update this user");
    if (isOwnSuperAdmin && ((updates.role !== undefined && updates.role !== existing.role) || (updates.is_active !== undefined && updates.is_active !== 1 && updates.is_active !== true))) {
      throw forbidden("You cannot change your own super admin role or deactivate your own account");
    }
    const normalized: Record<string, unknown> = {};
    const nextRole = String(updates.role || existing.role);
    if (isOperationsRole(existing.role) !== isOperationsRole(nextRole)) throw forbidden("Create a separate Library Operations account instead of converting a regular account");
    if (isOperationsRole(nextRole) && updates.email) throw new Error("Library Operations accounts do not use email");
    if (updates.name) normalized.name = updates.name;
    if (updates.role && !isOwnSuperAdmin && !(isUnverifiedSuperAdmin && updates.role === existing.role)) {
      const role = String(updates.role);
      if (!roleHierarchy[requesterRole]?.includes(role)) throw forbidden("You are not allowed to assign this role");
      if (role === requesterRole) throw forbidden("You cannot assign a user with your own role");
      normalized.role = updates.role;
    }
    const identityKeys = ["library_card_number", "student_number", "employee_number", "username", "program_id", "department_id", "year_level"];
    if (identityKeys.some((key) => updates[key] !== undefined) || updates.role) {
      const profile = roleProfile({ ...existing, ...updates }, nextRole);
      Object.assign(normalized, { student_employee_id: profile.studentEmployeeId, library_card_number: profile.libraryCardNumber, student_number: profile.studentNumber, employee_number: profile.employeeNumber, username: profile.username });
      normalized.program_id = ACADEMIC_ROLES.includes(nextRole) && nextRole !== "alumni" ? await ensureProgramExists(updates.program_id ?? existing.program_id, conn) : null;
      normalized.department_id = nextRole === "employee" ? await ensureDepartmentExists(updates.department_id ?? existing.department_id, conn) : null;
      if (nextRole !== "student") normalized.academic_term_id = null;
      normalized.year_level = ACADEMIC_ROLES.includes(nextRole) && nextRole !== "alumni" ? (updates.year_level ?? existing.year_level) : null;
    }
    if (!isOperationsRole(nextRole) && updates.email !== undefined && String(updates.email || "").trim().toLowerCase() !== String(existing.email || "").trim().toLowerCase()) {
      await accountEmail.stageAddress(conn, existing, updates.email);
    }
    if (updates.address !== undefined) normalized.address = updates.address;
    if (updates.contact !== undefined) normalized.contact = updates.contact;
    if (updates.remarks !== undefined) normalized.remarks = updates.remarks || null;
    if (updates.academic_term_id !== undefined) {
      const term = updates.academic_term_id ? await repository.findAcademicTerm(updates.academic_term_id as number | string, conn) : null;
      if (updates.academic_term_id && !term) throw new Error("Select a valid academic term");
      normalized.academic_term_id = term?.id ?? null;
    }
    if (updates.is_active !== undefined) normalized.is_active = updates.is_active ? 1 : 0;
    if (!Object.keys(normalized).length && updates.email === undefined) throw new Error("No valid fields to update");
    if (normalized.is_active === 0) {
      await assertUserHasNoOutstandingFines(existing.id, conn);
      const activeBorrows = await repository.findActiveBorrowings(existing.id, conn);
      if (activeBorrows.length) throw conflict(`User has ${activeBorrows.length} unreturned book${activeBorrows.length > 1 ? "s" : ""} — resolve before deactivating`);
      const activeReservations = await repository.findActiveReservations(existing.id, conn);
      if (activeReservations.length) throw conflict(`User has ${activeReservations.length} active reservation${activeReservations.length > 1 ? "s" : ""} — resolve before deactivating`);
      deactivatedUserId = existing.id;
    }
    await repository.updateUser(student_employee_id, normalized, conn);
    if (normalized.role !== undefined && normalized.role !== existing.role) {
      await conn.query("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [existing.id]);
      await conn.query("UPDATE auth_refresh_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [existing.id]);
      roleChangedUserId = existing.id;
    }
    const after = await repository.findUserByIdForAudit(existing.id, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: requesterId,
      category: "users",
      route: `/api/admin/users/${encodeURIComponent(student_employee_id)}`,
      description: normalized.is_active === 0 ? "Deactivated user account" : "Updated user account",
      before: existing,
      after,
      extraMetadata: {},
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw userFieldError(error, String(updates.role || ""));
  } finally { conn.release(); }
  if (deactivatedUserId) {
    try { await revokeAllRefreshSessionsForUser(deactivatedUserId); }
    catch (error) { console.error("[admin] User deactivation committed; refresh-session revocation failed:", error); }
  }
  if (roleChangedUserId) require("../../realtime/notificationHub").closeUserConnections(roleChangedUserId);
  return { message: "User updated successfully" };
};
const resetOperationsPassword = async (identifier: string, password: unknown, actorRole: string, actorId: number) => {
  if (!["admin", "super_admin"].includes(actorRole)) throw forbidden("Only administrators can reset Library Operations passwords");
  const hash = await bcrypt.hash(accountEmail.validatePassword(password), 12);
  const conn = await repository.getConnection();
  let userId = 0;
  try {
    await conn.beginTransaction();
    const user = await repository.findUserForUpdate(identifier, conn);
    if (!user || !isOperationsRole(user.role)) throw forbidden("Choose a Library Operations account");
    userId = user.id;
    await conn.query("UPDATE users SET password_hash=?,setup_pending=0,must_change_password=0,session_version=session_version+1 WHERE id=?", [hash, userId]);
    await conn.query("UPDATE auth_refresh_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL", [userId]);
    await accountEmail.invalidateChallenges(conn, userId);
    await enqueueTransactionalAudit(conn, { actorId, category: "users", action: "password_reset", description: "Reset Library Operations account password", route: `/api/admin/users/${encodeURIComponent(identifier)}/reset-password`, extraMetadata: { target_user_id: userId } });
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
  require("../../realtime/notificationHub").closeUserConnections(userId);
  return { message: "Password reset. Existing sessions have ended." };
};
const searchUsers = async (query: UserSearchQuery, requesterRole: string) => {
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) throw new Error("You are not allowed to search users");
  const showArchived = query.archived === "true";
  const requestedRole = typeof query.role === "string" ? query.role : undefined;
  if (requestedRole && !allowedRoles.includes(requestedRole)) {
    if (query.page !== undefined) return { rows: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } };
    return [];
  }
  const result = await repository.searchUsers({ allowedRoles, showArchived: false, studentEmployeeId: query.student_employee_id, name: query.name, status: "all_accounts" });
  const academicFilters = ["programId", "departmentId", "termId"].map(key => {
    const value = query[key];
    if (value == null || value === "") return null;
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error("Invalid academic filter"), { status: 400 });
    return { field: key === "programId" ? "program_id" : key === "departmentId" ? "department_id" : "academic_term_id", id };
  }).filter(Boolean);
  const allRows = (Array.isArray(result) ? result : result.rows).filter(row => academicFilters.every(filter => Number((row as unknown as Record<string, unknown>)[filter!.field]) === filter!.id));
  const { listUnsettledBorrowings } = require("../borrowing/overdue.helper");
  const fineDetails = await listUnsettledBorrowings({});
  const balances = new Map<number, number>();
  for (const fine of fineDetails.rows) balances.set(Number(fine.user_id), (balances.get(Number(fine.user_id)) || 0) + Number(fine.unsettled_amount));
  const enriched = allRows.map(row => ({ ...row, unpaid_fines: Math.round((balances.get(Number(row.user_id)) || 0) * 100) / 100 }));
  const statusOf = (row: typeof enriched[number]) => row.deleted_at ? "archived" : Number(row.is_active) === 0 ? "inactive" : "active";
  const attention = (row: typeof enriched[number]) => !row.deleted_at && (Number(row.overdue_loans) > 0 || row.unpaid_fines > 0);
  const roleRows = enriched.filter(row => !requestedRole || row.role === requestedRole);
  const statusCounts = Object.fromEntries(["active", "inactive", "archived", "all"].map(status => [status, roleRows.filter(row => status === "all" || statusOf(row) === status).length]));
  const roles = Object.fromEntries(allowedRoles.map(role => [role, enriched.filter(row => row.role === role).length]));
  const summary = { total: enriched.length, active: enriched.filter(row => statusOf(row) === "active").length, needsAttention: enriched.filter(attention).length, statuses: statusCounts, roles };
  const status = showArchived ? "archived" : String(query.status || "current");
  let rows = roleRows.filter(row => status === "all" || (status === "current" ? !row.deleted_at : statusOf(row) === status));
  if (query.access === "attention") rows = rows.filter(attention);
  if (query.access === "clear") rows = rows.filter(row => !attention(row));
  const sort = ["name", "name_desc", "attention"].includes(String(query.sort)) ? String(query.sort) : "name";
  rows.sort((a, b) => sort === "attention" ? Number(b.overdue_loans) - Number(a.overdue_loans) || b.unpaid_fines - a.unpaid_fines || a.name.localeCompare(b.name) : sort === "name_desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  if (query.page === undefined) return rows;
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
  return { rows: rows.slice((page - 1) * limit, page * limit), summary, pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) } };
};
const queryToolsSearch = async (term: string, requesterRole: string) => {
  const query = term?.trim();
  if (!query) throw new Error("Search term is required");
  const allowedRoles = searchRoleHierarchy[requesterRole];
  if (!allowedRoles?.length) throw new Error("You are not allowed to search query tools");
  return repository.queryToolsSearch(query, allowedRoles);
};
function userFieldError(error: unknown, role: string) {
  const e = error as Error & {status?: number; fieldErrors?: Record<string,string>};
  if (e.fieldErrors) return e;
  const email = /email|address/i.test(e.message || '');
  if (hasDuplicateKeyError(error) || e.status === 409 && email) {
    const field = email ? 'email' : ['student','alumni'].includes(role) ? 'libraryCardNumber' : role === 'employee' ? 'employeeNumber' : 'username';
    return Object.assign(new Error(email ? 'This email already belongs to another user.' : 'This identifier already belongs to another user.'), {status:409, fieldErrors:{[field]:email ? 'This email already belongs to another user.' : 'This identifier already belongs to another user.'}});
  }
  return error;
}
async function managedAccount(identifier: string, actorRole: string, actorId: number) {
  const account = await accountRepository.accountByIdentifier(identifier);
  if (!account || !(account.id === actorId || roleHierarchy[actorRole]?.includes(account.role) || (actorRole === 'super_admin' && account.role === 'super_admin' && !account.email_verified_at))) throw forbidden('You cannot manage this account');
  return account;
}
const checkAvailability = async (input: UserInput, actorRole: string, actorId: number) => {
  if (!roleHierarchy[actorRole]) throw forbidden('You cannot manage accounts');
  if (!['email','username'].includes(String(input.field))) throw new Error('Choose email or username');
  const field = input.field as 'email'|'username';
  const value = field === 'email' ? normalizeEmail(input.value) : String(input.value || '').trim();
  if (!value || value.length > (field === 'username' ? 64 : 255)) throw new Error('Enter a valid value');
  const excluded = input.excludeIdentifier ? await managedAccount(String(input.excludeIdentifier), actorRole, actorId) : null;
  return {available:await accountRepository.available(field,value,Number(excluded?.id || 0))};
};
const getAccountEmailStatus = async (identifier: string, actorRole: string, actorId: number) => {
  const account = await managedAccount(identifier,actorRole,actorId);
  if (isOperationsRole(account.role)) throw forbidden("Library Operations accounts do not use email");
  return {deliveries:await accountRepository.accountEmailStatus(account.id)};
};
export = { resetOperationsPassword, checkAvailability, getAccountEmailStatus, createUser, deleteUser, restoreUser, updateUser, searchUsers, queryToolsSearch };
