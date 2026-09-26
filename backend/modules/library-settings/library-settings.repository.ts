import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AcademicTermDeleteResult,
  AcademicTermInput,
  AcademicTermRecord,
  DepartmentDeletion,
  DepartmentRecord,
  HolidayInput,
  HolidayRecord,
  ProgramDeletion,
  ProgramRecord,
  RecordStatus,
  SettingsRecord,
} from "./library-settings.types";

const db = require("../../db") as Pool;
type QueryConnection = Pool | PoolConnection;

const getConnection = (): Promise<PoolConnection> => db.getConnection();

const ensureSettingsRow = async (conn: QueryConnection = db): Promise<void> => {
  await conn.query(
    `INSERT INTO library_circulation_settings (id, overdue_fine_per_hour)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [1],
  );
};

const getSettings = async (conn: QueryConnection = db): Promise<SettingsRecord | undefined> => {
  await ensureSettingsRow(conn);
  const [rows] = await conn.query<SettingsRecord[]>(
    `SELECT overdue_fine_per_hour, updated_at
     FROM library_circulation_settings
     WHERE id = 1
     LIMIT 1`,
  );
  return rows[0];
};

const updateSettings = async (overdueFinePerHour: number | string, updatedBy: number | null | undefined, conn: QueryConnection = db): Promise<SettingsRecord | undefined> => {
  await ensureSettingsRow(conn);
  await conn.query(
    `UPDATE library_circulation_settings
     SET overdue_fine_per_hour = ?, updated_by = ?
     WHERE id = 1`,
    [overdueFinePerHour, updatedBy ?? null],
  );
  return getSettings(conn);
};

const listHolidays = async ({ status = "active" }: { status?: RecordStatus | string } = {}, conn: QueryConnection = db): Promise<HolidayRecord[]> => {
  const statusFilter = status === "all" ? "" : status === "archived" ? "WHERE is_active = 0" : "WHERE is_active = 1";
  const [rows] = await conn.query<HolidayRecord[]>(
    `SELECT id, name, holiday_date, description, is_active, created_at, updated_at,
            NULL AS usage_count, 'Usage cannot be reliably reconstructed from saved due dates' AS usage_note
     FROM library_holidays
     ${statusFilter}
     ORDER BY holiday_date ASC, id ASC`,
  );
  return rows;
};

const createHoliday = async ({ name, holidayDate, description = null }: HolidayInput, userId: number | null | undefined, conn: QueryConnection = db): Promise<HolidayRecord> => {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO library_holidays
      (name, holiday_date, description, created_by, updated_by, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [name, holidayDate, description, userId ?? null, userId ?? null],
  );
  const [rows] = await conn.query<HolidayRecord[]>(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE id = ?`,
    [result.insertId],
  );
  return rows[0];
};

const updateHoliday = async (holidayId: number, { name, holidayDate, description = null }: HolidayInput, userId: number | null | undefined, conn: QueryConnection = db): Promise<HolidayRecord | null> => {
  const [result] = await conn.query<ResultSetHeader>(
    `UPDATE library_holidays
     SET name = ?, holiday_date = ?, description = ?, updated_by = ?
     WHERE id = ? AND is_active = 1`,
    [name, holidayDate, description, userId ?? null, holidayId],
  );
  if (!result.affectedRows) return null;
  const [rows] = await conn.query<HolidayRecord[]>(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE id = ?`,
    [holidayId],
  );
  return rows[0] ?? null;
};

const deleteHoliday = async (holidayId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<{ holiday: HolidayRecord; action: "archived" | "already_archived"; usage_count: null } | null> => {
  const [rows] = await conn.query<HolidayRecord[]>("SELECT id, name, holiday_date, is_active FROM library_holidays WHERE id = ? FOR UPDATE", [holidayId]);
  const [holiday] = rows;
  if (!holiday) return null;
  if (holiday.is_active) await conn.query("UPDATE library_holidays SET is_active = 0, updated_by = ? WHERE id = ?", [userId ?? null, holidayId]);
  return { holiday, action: holiday.is_active ? "archived" : "already_archived", usage_count: null };
};

const restoreHoliday = async (holidayId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<{ holiday: HolidayRecord; restored: boolean } | null> => {
  const [rows] = await conn.query<HolidayRecord[]>("SELECT id, name, holiday_date, is_active FROM library_holidays WHERE id = ? FOR UPDATE", [holidayId]);
  const [holiday] = rows;
  if (!holiday) return null;
  if (!holiday.is_active) await conn.query("UPDATE library_holidays SET is_active = 1, updated_by = ? WHERE id = ?", [userId ?? null, holidayId]);
  return { holiday, restored: !holiday.is_active };
};

const listAcademicPrograms = async ({ status = "active" }: { status?: RecordStatus | string } = {}, conn: QueryConnection = db): Promise<ProgramRecord[]> => {
  const statusFilter = status === "all" ? "" : status === "archived" ? "WHERE ap.is_active = 0" : "WHERE ap.is_active = 1";
  const [rows] = await conn.query<ProgramRecord[]>(
    `SELECT ap.id, ap.name, ap.is_active, ap.created_at, ap.updated_at,
       (SELECT COUNT(*) FROM users u WHERE u.program_id = ap.id) AS user_reference_count,
       (SELECT COUNT(*) FROM copy_holdings h WHERE h.program_id = ap.id) AS holding_reference_count
     FROM academic_programs ap
     ${statusFilter}
     ORDER BY ap.is_active DESC, ap.name ASC`,
  );
  return rows;
};

const createAcademicProgram = async ({ name }: { name: string }, userId: number | null | undefined, conn: QueryConnection = db): Promise<ProgramRecord> => {
  const [result] = await conn.query<ResultSetHeader>(
    "INSERT INTO academic_programs (name, created_by, updated_by) VALUES (?, ?, ?)",
    [name, userId ?? null, userId ?? null],
  );
  const [rows] = await conn.query<ProgramRecord[]>("SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?", [result.insertId]);
  return rows[0];
};

const updateAcademicProgram = async (programId: number, name: string, userId: number | null | undefined, conn: QueryConnection = db): Promise<ProgramRecord | null> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE academic_programs SET name = ?, updated_by = ? WHERE id = ? AND is_active = 1", [name, userId ?? null, programId]);
  if (!result.affectedRows) return null;
  const [rows] = await conn.query<ProgramRecord[]>("SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?", [programId]);
  return rows[0] ?? null;
};

const deleteAcademicProgram = async (programId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<ProgramDeletion | null> => {
  const [programRows] = await conn.query<ProgramRecord[]>("SELECT id, name, is_active FROM academic_programs WHERE id = ? FOR UPDATE", [programId]);
  const [program] = programRows;
  if (!program) return null;
  const [usageRows] = await conn.query<Array<RowDataPacket & { users: number | string; holdings: number | string }>>(
    `SELECT (SELECT COUNT(*) FROM users WHERE program_id = ?) AS users,
            (SELECT COUNT(*) FROM copy_holdings WHERE program_id = ?) AS holdings`,
    [programId, programId],
  );
  const usage = usageRows[0];
  const userCount = Number(usage.users || 0);
  const holdingCount = Number(usage.holdings || 0);
  const referenceCount = userCount + holdingCount;
  if (referenceCount) {
    if (program.is_active) await conn.query("UPDATE academic_programs SET is_active = 0, updated_by = ? WHERE id = ?", [userId ?? null, programId]);
    return { action: "archived", program, user_reference_count: userCount, holding_reference_count: holdingCount, reference_count: referenceCount };
  }
  const [result] = await conn.query<ResultSetHeader>("DELETE FROM academic_programs WHERE id = ?", [programId]);
  return result.affectedRows
    ? { action: "deleted", program, user_reference_count: 0, holding_reference_count: 0, reference_count: 0 }
    : null;
};

const restoreAcademicProgram = async (programId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE academic_programs SET is_active = 1, updated_by = ? WHERE id = ? AND is_active = 0", [userId ?? null, programId]);
  return result.affectedRows;
};

const listDepartments = async ({ status = "active" }: { status?: RecordStatus | string } = {}, conn: QueryConnection = db): Promise<DepartmentRecord[]> => {
  const statusFilter = status === "all" ? "" : status === "archived" ? "WHERE d.is_active = 0" : "WHERE d.is_active = 1";
  const [rows] = await conn.query<DepartmentRecord[]>(
    `SELECT d.id, d.name, d.is_active, d.created_at, d.updated_at,
       (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS user_reference_count
     FROM departments d ${statusFilter} ORDER BY d.is_active DESC, d.name ASC`,
  );
  return rows;
};

const createDepartment = async ({ name }: { name: string }, userId: number | null | undefined, conn: QueryConnection = db): Promise<DepartmentRecord> => {
  const [result] = await conn.query<ResultSetHeader>("INSERT INTO departments (name, created_by, updated_by) VALUES (?, ?, ?)", [name, userId ?? null, userId ?? null]);
  const [rows] = await conn.query<DepartmentRecord[]>("SELECT id, name, is_active, created_at, updated_at FROM departments WHERE id = ?", [result.insertId]);
  return rows[0];
};

const updateDepartment = async (departmentId: number, name: string, userId: number | null | undefined, conn: QueryConnection = db): Promise<DepartmentRecord | null> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE departments SET name = ?, updated_by = ? WHERE id = ? AND is_active = 1", [name, userId ?? null, departmentId]);
  if (!result.affectedRows) return null;
  const [rows] = await conn.query<DepartmentRecord[]>("SELECT id, name, is_active, created_at, updated_at FROM departments WHERE id = ?", [departmentId]);
  return rows[0] ?? null;
};

const deleteDepartment = async (departmentId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<DepartmentDeletion | null> => {
  const [departmentRows] = await conn.query<DepartmentRecord[]>("SELECT id, name, is_active FROM departments WHERE id = ? FOR UPDATE", [departmentId]);
  const [department] = departmentRows;
  if (!department) return null;
  const [usageRows] = await conn.query<Array<RowDataPacket & { total: number | string }>>("SELECT COUNT(*) AS total FROM users WHERE department_id = ?", [departmentId]);
  const count = Number(usageRows[0].total || 0);
  if (count) {
    if (department.is_active) await conn.query("UPDATE departments SET is_active = 0, updated_by = ? WHERE id = ?", [userId ?? null, departmentId]);
    return { action: "archived", department, user_reference_count: count, reference_count: count };
  }
  const [result] = await conn.query<ResultSetHeader>("DELETE FROM departments WHERE id = ?", [departmentId]);
  return result.affectedRows ? { action: "deleted", department, user_reference_count: 0, reference_count: 0 } : null;
};

const restoreDepartment = async (departmentId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<number> => {
  const [result] = await conn.query<ResultSetHeader>("UPDATE departments SET is_active = 1, updated_by = ? WHERE id = ? AND is_active = 0", [userId ?? null, departmentId]);
  return result.affectedRows;
};

const listAcademicTerms = async (conn: QueryConnection = db): Promise<AcademicTermRecord[]> => {
  const [rows] = await conn.query<AcademicTermRecord[]>("SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms ORDER BY starts_on DESC, id DESC");
  return rows;
};

const createAcademicTerm = async ({ name, startsOn, endsOn, isCurrent = false }: AcademicTermInput, userId: number | null | undefined, conn: QueryConnection = db): Promise<AcademicTermRecord> => {
  const [countRows] = await conn.query<Array<RowDataPacket & { total: number | string }>>("SELECT COUNT(*) AS total FROM academic_terms");
  const shouldBeCurrent = Boolean(isCurrent) || Number(countRows[0].total) === 0;
  if (shouldBeCurrent) await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  const [result] = await conn.query<ResultSetHeader>(
    "INSERT INTO academic_terms (name, starts_on, ends_on, is_current, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)",
    [name, startsOn, endsOn, shouldBeCurrent ? 1 : 0, userId ?? null, userId ?? null],
  );
  const [rows] = await conn.query<AcademicTermRecord[]>("SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms WHERE id = ?", [result.insertId]);
  return rows[0];
};

const updateAcademicTerm = async (termId: number, { name, startsOn, endsOn, isCurrent = false }: AcademicTermInput, userId: number | null | undefined, conn: QueryConnection = db): Promise<AcademicTermRecord | null> => {
  const [existingRows] = await conn.query<Array<RowDataPacket & { id: number; is_current: number | boolean }>>("SELECT id, is_current FROM academic_terms WHERE id = ? FOR UPDATE", [termId]);
  const [existing] = existingRows;
  if (!existing) return null;
  if (!isCurrent && existing.is_current) throw Object.assign(new Error("Choose another current term before unsetting this one"), { status: 409 });
  if (isCurrent) await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1 AND id <> ?", [userId ?? null, termId]);
  const [result] = await conn.query<ResultSetHeader>(
    "UPDATE academic_terms SET name = ?, starts_on = ?, ends_on = ?, is_current = ?, updated_by = ? WHERE id = ?",
    [name, startsOn, endsOn, isCurrent ? 1 : 0, userId ?? null, termId],
  );
  if (!result.affectedRows) return null;
  const [rows] = await conn.query<AcademicTermRecord[]>("SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms WHERE id = ?", [termId]);
  return rows[0] ?? null;
};

const deleteAcademicTerm = async (termId: number, conn: QueryConnection = db): Promise<AcademicTermDeleteResult> => {
  const [termRows] = await conn.query<AcademicTermRecord[]>("SELECT id, name, is_current FROM academic_terms WHERE id = ? FOR UPDATE", [termId]);
  const [term] = termRows;
  if (!term) return { term: null, usage: 0 };
  const [usageRows] = await conn.query<Array<RowDataPacket & { total: number | string }>>("SELECT COUNT(*) AS total FROM users WHERE academic_term_id = ?", [termId]);
  const usage = Number(usageRows[0].total);
  if (usage || term.is_current) return { term, usage, deleted: false };
  const [result] = await conn.query<ResultSetHeader>("DELETE FROM academic_terms WHERE id = ?", [termId]);
  return { term, usage: 0, deleted: result.affectedRows === 1 };
};

const setCurrentAcademicTerm = async (termId: number, userId: number | null | undefined, conn: QueryConnection = db): Promise<boolean> => {
  const [termRows] = await conn.query<Array<RowDataPacket & { id: number }>>("SELECT id FROM academic_terms WHERE id = ? FOR UPDATE", [termId]);
  if (!termRows[0]) return false;
  await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  const [result] = await conn.query<ResultSetHeader>("UPDATE academic_terms SET is_current = 1, updated_by = ? WHERE id = ?", [userId ?? null, termId]);
  return result.affectedRows === 1;
};

export = {
  getConnection,
  getSettings,
  updateSettings,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  restoreHoliday,
  listAcademicPrograms,
  createAcademicProgram,
  updateAcademicProgram,
  deleteAcademicProgram,
  restoreAcademicProgram,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
  listAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
  setCurrentAcademicTerm,
};
