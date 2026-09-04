const db = require("../../db");

const DEFAULT_SETTINGS = {
  overdue_fine_per_hour: 1,
};

const normaliseSettings = (row) => ({
  overdue_fine_per_hour: Number(row?.overdue_fine_per_hour ?? DEFAULT_SETTINGS.overdue_fine_per_hour),
  updated_at: row?.updated_at ?? null,
});

const ensureSettingsRow = async (conn = db) => {
  await conn.query(
    `INSERT INTO library_circulation_settings (id, overdue_fine_per_hour)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [DEFAULT_SETTINGS.overdue_fine_per_hour]
  );
};

const getSettings = async (conn = db) => {
  await ensureSettingsRow(conn);

  const [[row]] = await conn.query(
    `SELECT overdue_fine_per_hour, updated_at
     FROM library_circulation_settings
     WHERE id = 1
     LIMIT 1`
  );

  return normaliseSettings(row);
};

const updateSettings = async ({ overdueFinePerHour }, updatedBy, conn = db) => {
  const numericRate = Number(overdueFinePerHour);

  if (!Number.isFinite(numericRate) || numericRate < 0) {
    throw Object.assign(new Error("Overdue fine per hour must be a non-negative number"), {
      status: 400,
    });
  }

  await ensureSettingsRow(conn);
  await conn.query(
    `UPDATE library_circulation_settings
     SET overdue_fine_per_hour = ?, updated_by = ?
     WHERE id = 1`,
    [numericRate.toFixed(2), updatedBy ?? null]
  );

  return getSettings(conn);
};

const listHolidays = async (conn = db) => {
  const [rows] = await conn.query(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE is_active = 1
     ORDER BY holiday_date ASC, id ASC`
  );

  return rows;
};

const getHolidayDateSet = async (conn = db) => {
  const holidays = await listHolidays(conn);
  return new Set(holidays.map((holiday) => {
    const date = new Date(holiday.holiday_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }));
};

const createHoliday = async ({ name, holidayDate, description }, userId, conn = db) => {
  if (!name?.trim()) {
    throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  }

  if (!holidayDate?.trim()) {
    throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  }

  try {
    const [result] = await conn.query(
      `INSERT INTO library_holidays
        (name, holiday_date, description, created_by, updated_by, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name.trim(), holidayDate.trim(), description?.trim() || null, userId ?? null, userId ?? null]
    );

    const [[holiday]] = await conn.query(
      `SELECT id, name, holiday_date, description, created_at, updated_at
       FROM library_holidays
       WHERE id = ?`,
      [result.insertId]
    );

    return holiday;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("A holiday already exists for that date"), { status: 409 });
    }
    throw error;
  }
};

const updateHoliday = async (holidayId, { name, holidayDate, description }, userId, conn = db) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) {
    throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  }

  if (!name?.trim()) {
    throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  }

  if (!holidayDate?.trim()) {
    throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  }

  try {
    const [result] = await conn.query(
      `UPDATE library_holidays
       SET name = ?, holiday_date = ?, description = ?, updated_by = ?
       WHERE id = ? AND is_active = 1`,
      [name.trim(), holidayDate.trim(), description?.trim() || null, userId ?? null, holidayId]
    );

    if (!result.affectedRows) {
      throw Object.assign(new Error("Holiday not found"), { status: 404 });
    }

    const [[holiday]] = await conn.query(
      `SELECT id, name, holiday_date, description, created_at, updated_at
       FROM library_holidays
       WHERE id = ?`,
      [holidayId]
    );

    return holiday;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw Object.assign(new Error("A holiday already exists for that date"), { status: 409 });
    }
    throw error;
  }
};

const deleteHoliday = async (holidayId, userId, conn = db) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) {
    throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  }

  const [result] = await conn.query(
    `UPDATE library_holidays
     SET is_active = 0, updated_by = ?
     WHERE id = ? AND is_active = 1`,
    [userId ?? null, holidayId]
  );

  if (!result.affectedRows) {
    throw Object.assign(new Error("Holiday not found"), { status: 404 });
  }

  return { success: true };
};

const listAcademicPrograms = async ({ activeOnly = true } = {}, conn = db) => {
  const [rows] = await conn.query(
    `SELECT id, name, is_active, created_at, updated_at
     FROM academic_programs
     ${activeOnly ? "WHERE is_active = 1" : ""}
     ORDER BY name ASC`
  );
  return rows;
};

const createAcademicProgram = async ({ name }, userId, conn = db) => {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    const [result] = await conn.query(
      "INSERT INTO academic_programs (name, created_by, updated_by) VALUES (?, ?, ?)",
      [cleanedName, userId ?? null, userId ?? null]
    );
    const [[program]] = await conn.query("SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?", [result.insertId]);
    return program;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw Object.assign(new Error("This program / course already exists"), { status: 409 });
    throw error;
  }
};

const updateAcademicProgram = async (programId, { name }, userId, conn = db) => {
  const cleanedName = String(name || "").trim();
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    const [result] = await conn.query(
      "UPDATE academic_programs SET name = ?, updated_by = ? WHERE id = ? AND is_active = 1",
      [cleanedName, userId ?? null, programId]
    );
    if (!result.affectedRows) throw Object.assign(new Error("Program / course not found"), { status: 404 });
    const [[program]] = await conn.query("SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?", [programId]);
    return program;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw Object.assign(new Error("This program / course already exists"), { status: 409 });
    throw error;
  }
};

const deleteAcademicProgram = async (programId, userId, conn = db) => {
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  const [result] = await conn.query(
    "UPDATE academic_programs SET is_active = 0, updated_by = ? WHERE id = ? AND is_active = 1",
    [userId ?? null, programId]
  );
  if (!result.affectedRows) throw Object.assign(new Error("Program / course not found"), { status: 404 });
  return { success: true };
};

const listAcademicTerms = async (conn = db) => {
  const [rows] = await conn.query("SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms ORDER BY starts_on DESC, id DESC");
  return rows;
};

const createAcademicTerm = async ({ name, startsOn, endsOn, isCurrent }, userId, conn = db) => {
  if (!String(name || "").trim() || !startsOn || !endsOn) throw Object.assign(new Error("Term name and dates are required"), { status: 400 });
  if (new Date(startsOn) > new Date(endsOn)) throw Object.assign(new Error("The end date must be after the start date"), { status: 400 });
  if (isCurrent) await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  const [result] = await conn.query("INSERT INTO academic_terms (name, starts_on, ends_on, is_current, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)", [String(name).trim(), startsOn, endsOn, isCurrent ? 1 : 0, userId ?? null, userId ?? null]);
  const [[term]] = await conn.query("SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms WHERE id = ?", [result.insertId]);
  return term;
};

const setCurrentAcademicTerm = async (termId, userId, conn = db) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  const [[term]] = await conn.query("SELECT id FROM academic_terms WHERE id = ?", [termId]);
  if (!term) throw Object.assign(new Error("Academic term not found"), { status: 404 });
  await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  await conn.query("UPDATE academic_terms SET is_current = 1, updated_by = ? WHERE id = ?", [userId ?? null, termId]);
  return { success: true };
};

module.exports = {
  getSettings,
  updateSettings,
  listHolidays,
  getHolidayDateSet,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listAcademicPrograms,
  createAcademicProgram,
  updateAcademicProgram,
  deleteAcademicProgram,
  listAcademicTerms,
  createAcademicTerm,
  setCurrentAcademicTerm,
};
