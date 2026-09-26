import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import repository = require("./library-settings.repository");
import type {
  AcademicTermInput,
  ErrorWithCode,
  HolidayInput,
  RecordStatus,
  SettingsRecord,
  SnapshotRecord,
} from "./library-settings.types";

const { enqueueTransactionalAudit } = require("../analytics/transactional-audit") as {
  enqueueTransactionalAudit: (conn: PoolConnection, options: Record<string, unknown>) => Promise<void>;
};

type SettingKind = "holiday" | "program" | "department" | "term";
type OptionalConnection = PoolConnection | undefined;
type NameInput = { name: string };
type HolidayStatusOptions = { status?: RecordStatus | string };
const isDuplicateEntry = (error: unknown): boolean => (error as ErrorWithCode | null)?.code === "ER_DUP_ENTRY";

const DEFAULT_SETTINGS = { overdue_fine_per_hour: 1 };

const normaliseSettings = (row: SettingsRecord | undefined | null) => ({
  overdue_fine_per_hour: Number(row?.overdue_fine_per_hour ?? DEFAULT_SETTINGS.overdue_fine_per_hour),
  updated_at: row?.updated_at ?? null,
});

const duplicateError = (message: string) => Object.assign(new Error(message), { status: 409 });

const snapshotQueries = {
  holiday: "SELECT id, name, holiday_date, description, is_active FROM library_holidays WHERE id = ? FOR UPDATE",
  program: "SELECT id, name, is_active FROM academic_programs WHERE id = ? FOR UPDATE",
  department: "SELECT id, name, is_active FROM departments WHERE id = ? FOR UPDATE",
  term: "SELECT id, name, starts_on, ends_on, is_current FROM academic_terms WHERE id = ? FOR UPDATE",
} as const;
const settingSnapshot = async (conn: PoolConnection, kind: SettingKind, id: number): Promise<SnapshotRecord | null> => {
  const [rows] = await conn.query<SnapshotRecord[]>(snapshotQueries[kind], [id]);
  return rows[0] || null;
};
const auditSetting = (conn: PoolConnection, options: Record<string, unknown>): Promise<void> => enqueueTransactionalAudit(conn, {
  category: "academic_settings",
  ...options,
});

const withTransaction = async <T>(existingConnection: OptionalConnection | null, work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  if (existingConnection) return work(existingConnection);
  const connection = await repository.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getSettings = async (conn?: PoolConnection) => normaliseSettings(await repository.getSettings(conn));

const updateSettings = async ({ overdueFinePerHour }: { overdueFinePerHour: unknown }, updatedBy: number | undefined, conn?: PoolConnection) => {
  const numericRate = Number(overdueFinePerHour);
  if (!Number.isFinite(numericRate) || numericRate < 0) {
    throw Object.assign(new Error("Overdue fine per hour must be a non-negative number"), { status: 400 });
  }
  return withTransaction(conn, async (connection) => {
    await repository.getSettings(connection);
    const [beforeRows] = await connection.query<RowDataPacket[]>("SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1 FOR UPDATE");
    const [before] = beforeRows;
    await repository.updateSettings(numericRate.toFixed(2), updatedBy, connection);
    const [afterRows] = await connection.query<RowDataPacket[]>("SELECT overdue_fine_per_hour FROM library_circulation_settings WHERE id = 1");
    const [after] = afterRows;
    await auditSetting(connection, {
      actorId: updatedBy,
      route: "/api/admin/library-settings",
      description: "Updated circulation settings",
      before,
      after,
    });
    return normaliseSettings(await repository.getSettings(connection));
  });
};

const listHolidays = async (options: HolidayStatusOptions = {}, conn?: PoolConnection) => repository.listHolidays(options, conn);

const getHolidayDateSet = async (conn?: PoolConnection): Promise<Set<string>> => {
  const holidays = await listHolidays({ status: "active" }, conn);
  return new Set(holidays.map((holiday) => {
    const date = new Date(holiday.holiday_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }));
};

const createHoliday = async ({ name, holidayDate, description }: HolidayInput, userId: number | undefined, conn?: PoolConnection) => {
  if (!name?.trim()) throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  if (!holidayDate?.trim()) throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const holiday = await repository.createHoliday(
        { name: name.trim(), holidayDate: holidayDate.trim(), description: description?.trim() || null }, userId, connection,
      );
      const after = await settingSnapshot(connection, "holiday", holiday.id);
      await auditSetting(connection, { actorId: userId, route: "/api/admin/library-holidays", action: "created", description: `Added holiday “${after!.name}”`, before: null, after, isCreation: true });
      return holiday;
    });
  } catch (error: unknown) {
      if (isDuplicateEntry(error)) throw duplicateError("That date is already used by an active or archived holiday. Check Archived and restore it, or choose another date.");
    throw error;
  }
};

const updateHoliday = async (holidayId: number, { name, holidayDate, description }: HolidayInput, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  if (!name?.trim()) throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  if (!holidayDate?.trim()) throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "holiday", holidayId);
      const holiday = await repository.updateHoliday(
        holidayId,
        { name: name.trim(), holidayDate: holidayDate.trim(), description: description?.trim() || null }, userId, connection,
      );
      if (!holiday) throw Object.assign(new Error("Holiday not found"), { status: 404 });
      const after = await settingSnapshot(connection, "holiday", holidayId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/library-holidays/${holidayId}`, description: `Updated holiday “${after!.name}”`, before, after });
      return holiday;
    });
  } catch (error: unknown) {
      if (isDuplicateEntry(error)) throw duplicateError("That date is already used by an active or archived holiday. Check Archived and restore it, or choose another date.");
    throw error;
  }
};

const deleteHoliday = async (holidayId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  return withTransaction(conn, async (connection) => {
    const result = await repository.deleteHoliday(holidayId, userId, connection);
    if (!result) throw Object.assign(new Error("Holiday not found"), { status: 404 });
    const after = await settingSnapshot(connection, "holiday", holidayId);
    await auditSetting(connection, {
      actorId: userId,
      route: `/api/admin/library-holidays/${holidayId}`,
      action: "archived",
      description: `Archived holiday “${result.holiday.name}”`,
      before: result.holiday,
      after,
    });
    return { success: true, ...result };
  });
};

const restoreHoliday = async (holidayId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const result = await repository.restoreHoliday(holidayId, userId, connection);
      if (!result) throw Object.assign(new Error("Archived holiday not found"), { status: 404 });
      const after = await settingSnapshot(connection, "holiday", holidayId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/library-holidays/${holidayId}/restore`, action: "restored", description: `Restored holiday “${result.holiday.name}”`, before: result.holiday, after });
      return { success: true, ...result };
    });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw duplicateError("Another holiday already uses this date. Change that holiday's date before restoring.");
    throw error;
  }
};

const listAcademicPrograms = async ({ status = "active" }: HolidayStatusOptions = {}, conn?: PoolConnection) => repository.listAcademicPrograms({ status }, conn);

const createAcademicProgram = async ({ name }: NameInput, userId: number | undefined, conn?: PoolConnection) => {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const program = await repository.createAcademicProgram({ name: cleanedName }, userId, connection);
      const after = await settingSnapshot(connection, "program", program.id);
      await auditSetting(connection, { actorId: userId, route: "/api/admin/academic-programs", action: "created", description: `Created program / course “${after!.name}”`, before: null, after, isCreation: true });
      return program;
    });
  } catch (error: unknown) {
      if (isDuplicateEntry(error)) throw duplicateError("That program / course name is already used by an active or archived record. Check Archived and restore it, or choose another name.");
    throw error;
  }
};

const updateAcademicProgram = async (programId: number, { name }: NameInput, userId: number | undefined, conn?: PoolConnection) => {
  const cleanedName = String(name || "").trim();
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "program", programId);
      const program = await repository.updateAcademicProgram(programId, cleanedName, userId, connection);
      if (!program) throw Object.assign(new Error("Program / course not found or archived"), { status: 404 });
      const after = await settingSnapshot(connection, "program", programId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/academic-programs/${programId}`, description: `Updated program / course “${after!.name}”`, before, after });
      return program;
    });
  } catch (error: unknown) {
      if (isDuplicateEntry(error)) throw duplicateError("That program / course name is already used by an active or archived record. Check Archived and restore it, or choose another name.");
    throw error;
  }
};

const deleteAcademicProgram = async (programId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  return withTransaction(conn, async (connection) => {
    const result = await repository.deleteAcademicProgram(programId, userId, connection);
    if (!result) throw Object.assign(new Error("Program / course not found"), { status: 404 });
    const after = await settingSnapshot(connection, "program", programId);
    await auditSetting(connection, {
      actorId: userId,
      route: `/api/admin/academic-programs/${programId}`,
      action: result.action,
      description: `${result.action === "deleted" ? "Deleted" : "Archived"} program / course “${result.program.name}” · ${result.reference_count} references`,
      before: result.program,
      after,
      type: result.action === "deleted" ? "state_transition" : "field_changes",
      details: result.action === "deleted" ? { stateFrom: "Present", stateTo: "Deleted", stateLabel: "Record state" } : null,
      extraMetadata: { user_reference_count: result.user_reference_count, holding_reference_count: result.holding_reference_count },
    });
    return { success: true, ...result };
  });
};
const restoreAcademicProgram = async (programId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "program", programId);
      const restored = await repository.restoreAcademicProgram(programId, userId, connection);
      if (!restored) throw Object.assign(new Error("Archived program / course not found"), { status: 404 });
      const after = await settingSnapshot(connection, "program", programId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/academic-programs/${programId}/restore`, action: "restored", description: `Restored program / course “${after!.name}”`, before, after });
      return { success: true };
    });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw duplicateError("Another program / course already uses this name. Rename or delete that entry before restoring.");
    throw error;
  }
};

const listDepartments = async ({ status = "active" }: HolidayStatusOptions = {}, conn?: PoolConnection) => repository.listDepartments({ status }, conn);
const createDepartment = async ({ name }: NameInput, userId: number | undefined, conn?: PoolConnection) => {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) throw Object.assign(new Error("Department name is required"), { status: 400 });
  try { return await withTransaction(conn, async (connection) => {
    const department = await repository.createDepartment({ name: cleanedName }, userId, connection);
    const after = await settingSnapshot(connection, "department", department.id);
    await auditSetting(connection, { actorId: userId, route: "/api/admin/departments", action: "created", description: `Created department “${after!.name}”`, before: null, after, isCreation: true });
    return department;
  }); }
  catch (error: unknown) { if (isDuplicateEntry(error)) throw duplicateError("That department name is already used by an active or archived record. Check Archived and restore it, or choose another name."); throw error; }
};
const updateDepartment = async (departmentId: number, { name }: NameInput, userId: number | undefined, conn?: PoolConnection) => {
  const cleanedName = String(name || "").trim();
  if (!Number.isInteger(departmentId) || departmentId < 1) throw Object.assign(new Error("Invalid department"), { status: 400 });
  if (!cleanedName) throw Object.assign(new Error("Department name is required"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "department", departmentId);
      const department = await repository.updateDepartment(departmentId, cleanedName, userId, connection);
      if (!department) throw Object.assign(new Error("Department not found or archived"), { status: 404 });
      const after = await settingSnapshot(connection, "department", departmentId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/departments/${departmentId}`, description: `Updated department “${after!.name}”`, before, after });
      return department;
    });
  } catch (error: unknown) { if (isDuplicateEntry(error)) throw duplicateError("That department name is already used by an active or archived record. Check Archived and restore it, or choose another name."); throw error; }
};
const deleteDepartment = async (departmentId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(departmentId) || departmentId < 1) throw Object.assign(new Error("Invalid department"), { status: 400 });
  return withTransaction(conn, async (connection) => {
    const result = await repository.deleteDepartment(departmentId, userId, connection);
    if (!result) throw Object.assign(new Error("Department not found"), { status: 404 });
    const after = await settingSnapshot(connection, "department", departmentId);
    await auditSetting(connection, {
      actorId: userId,
      route: `/api/admin/departments/${departmentId}`,
      action: result.action,
      description: `${result.action === "deleted" ? "Deleted" : "Archived"} department “${result.department.name}” · ${result.reference_count} references`,
      before: result.department,
      after,
      type: result.action === "deleted" ? "state_transition" : "field_changes",
      details: result.action === "deleted" ? { stateFrom: "Present", stateTo: "Deleted", stateLabel: "Record state" } : null,
      extraMetadata: { user_reference_count: result.user_reference_count },
    });
    return { success: true, ...result };
  });
};
const restoreDepartment = async (departmentId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(departmentId) || departmentId < 1) throw Object.assign(new Error("Invalid department"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "department", departmentId);
      const restored = await repository.restoreDepartment(departmentId, userId, connection);
      if (!restored) throw Object.assign(new Error("Archived department not found"), { status: 404 });
      const after = await settingSnapshot(connection, "department", departmentId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/departments/${departmentId}/restore`, action: "restored", description: `Restored department “${after!.name}”`, before, after });
      return { success: true };
    });
  } catch (error: unknown) { if (isDuplicateEntry(error)) throw duplicateError("Another department already uses this name. Rename or delete that entry before restoring."); throw error; }
};

const listAcademicTerms = async (conn?: PoolConnection) => repository.listAcademicTerms(conn);

const validateTerm = ({ name, startsOn, endsOn }: Pick<AcademicTermInput, "name" | "startsOn" | "endsOn">): void => {
  if (!String(name || "").trim() || !startsOn || !endsOn) {
    throw Object.assign(new Error("Term name and dates are required"), { status: 400 });
  }
  if (new Date(startsOn) > new Date(endsOn)) {
    throw Object.assign(new Error("The end date must be after the start date"), { status: 400 });
  }
};

const createAcademicTerm = async ({ name, startsOn, endsOn, isCurrent }: AcademicTermInput, userId: number | undefined, conn?: PoolConnection) => {
  validateTerm({ name, startsOn, endsOn });
  try {
    return await withTransaction(conn, async (connection) => {
      const [currentRows] = await connection.query<Array<RowDataPacket & { id: number; name: string }>>("SELECT id, name FROM academic_terms WHERE is_current = 1 LIMIT 1");
      const [currentBefore] = currentRows;
      const term = await repository.createAcademicTerm(
        { name: String(name).trim(), startsOn, endsOn, isCurrent }, userId, connection,
      );
      const after = await settingSnapshot(connection, "term", term.id);
      await auditSetting(connection, {
        actorId: userId,
        route: "/api/admin/academic-terms",
        action: "created",
        description: `Created academic term “${term.name}”`,
        before: null,
        after,
        isCreation: true,
        extraMetadata: term.is_current ? { current_term_change: { before: currentBefore?.name ?? "None", after: term.name } } : {},
      });
      return term;
    });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw duplicateError("Another academic term became current at the same time. Reload the list and try again.");
    throw error;
  }
};

const updateAcademicTerm = async (termId: number, { name, startsOn, endsOn, isCurrent }: AcademicTermInput, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  validateTerm({ name, startsOn, endsOn });
  try {
    const term = await withTransaction(conn, async (connection) => {
      const before = await settingSnapshot(connection, "term", termId);
      const updated = await repository.updateAcademicTerm(termId, { name: String(name).trim(), startsOn, endsOn, isCurrent }, userId, connection);
      if (!updated) throw Object.assign(new Error("Academic term not found"), { status: 404 });
      const after = await settingSnapshot(connection, "term", termId);
      await auditSetting(connection, { actorId: userId, route: `/api/admin/academic-terms/${termId}`, description: `Updated academic term “${updated.name}”`, before, after });
      return updated;
    });
    return term;
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw duplicateError("Another academic term became current at the same time. Reload the list and try again.");
    throw error;
  }
};

const deleteAcademicTerm = async (termId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  return withTransaction(conn, async (connection) => {
    const { term, usage, deleted } = await repository.deleteAcademicTerm(termId, connection);
    if (!term) throw Object.assign(new Error("Academic term not found"), { status: 404 });
    if (term.is_current) throw Object.assign(new Error("Set another term as current before deleting this term"), { status: 409 });
    if (usage) throw Object.assign(new Error(`This term is assigned to ${usage} user record${usage === 1 ? "" : "s"} and cannot be deleted`), { status: 409, usage });
    if (!deleted) throw Object.assign(new Error("Academic term changed while it was being deleted. Reload the list and try again."), { status: 409 });
    await auditSetting(connection, {
      actorId: userId,
      route: `/api/admin/academic-terms/${termId}`,
      action: "deleted",
      description: `Deleted academic term “${term.name}”`,
      before: term,
      after: null,
      type: "state_transition",
      details: { stateFrom: "Present", stateTo: "Deleted", stateLabel: "Term record" },
      extraMetadata: { assigned_user_count: 0 },
    });
    return { success: true };
  });
};

const setCurrentAcademicTerm = async (termId: number, userId: number | undefined, conn?: PoolConnection) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  try {
    return await withTransaction(conn, async (connection) => {
      const [previousRows] = await connection.query<Array<RowDataPacket & { name: string }>>("SELECT name FROM academic_terms WHERE is_current = 1 LIMIT 1");
      const [previousCurrent] = previousRows;
      const target = await settingSnapshot(connection, "term", termId);
      const updated = await repository.setCurrentAcademicTerm(termId, userId, connection);
      if (!updated) throw Object.assign(new Error("Academic term not found"), { status: 404 });
      const [savedRows] = await connection.query<Array<RowDataPacket & { name: string }>>("SELECT name FROM academic_terms WHERE is_current = 1 LIMIT 1");
      const [savedCurrent] = savedRows;
      await auditSetting(connection, {
        actorId: userId,
        route: `/api/admin/academic-terms/${termId}/current`,
        action: "set_current",
        description: `Set current academic term to “${savedCurrent?.name || target?.name}”`,
        before: null,
        after: null,
        type: "state_transition",
        details: { stateFrom: previousCurrent?.name ?? "None", stateTo: savedCurrent?.name ?? target?.name, stateLabel: "Current academic term" },
      });
      return { success: true };
    });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) throw duplicateError("Another academic term became current at the same time. Reload the list and try again.");
    throw error;
  }
};

export = {
  getSettings,
  updateSettings,
  listHolidays,
  getHolidayDateSet,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  restoreHoliday,
  listAcademicPrograms,
  createAcademicProgram,
  updateAcademicProgram,
  deleteAcademicProgram,
  restoreAcademicProgram,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  restoreDepartment,
  listAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
  setCurrentAcademicTerm,
};
