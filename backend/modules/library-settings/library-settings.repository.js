const db = require("../../db");

const ensureSettingsRow = async (conn = db) => {
  await conn.query(
    `INSERT INTO library_circulation_settings (id, overdue_fine_per_hour)
     VALUES (1, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [1],
  );
};

const getSettings = async (conn = db) => {
  await ensureSettingsRow(conn);
  const [[row]] = await conn.query(
    `SELECT overdue_fine_per_hour, updated_at
     FROM library_circulation_settings
     WHERE id = 1
     LIMIT 1`,
  );
  return row;
};

const updateSettings = async (overdueFinePerHour, updatedBy, conn = db) => {
  await ensureSettingsRow(conn);
  await conn.query(
    `UPDATE library_circulation_settings
     SET overdue_fine_per_hour = ?, updated_by = ?
     WHERE id = 1`,
    [overdueFinePerHour, updatedBy ?? null],
  );
  return getSettings(conn);
};

const listHolidays = async (conn = db) => {
  const [rows] = await conn.query(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE is_active = 1
     ORDER BY holiday_date ASC, id ASC`,
  );
  return rows;
};

const createHoliday = async ({ name, holidayDate, description }, userId, conn = db) => {
  const [result] = await conn.query(
    `INSERT INTO library_holidays
      (name, holiday_date, description, created_by, updated_by, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [name, holidayDate, description, userId ?? null, userId ?? null],
  );
  const [[holiday]] = await conn.query(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE id = ?`,
    [result.insertId],
  );
  return holiday;
};

const updateHoliday = async (holidayId, { name, holidayDate, description }, userId, conn = db) => {
  const [result] = await conn.query(
    `UPDATE library_holidays
     SET name = ?, holiday_date = ?, description = ?, updated_by = ?
     WHERE id = ? AND is_active = 1`,
    [name, holidayDate, description, userId ?? null, holidayId],
  );
  if (!result.affectedRows) return null;
  const [[holiday]] = await conn.query(
    `SELECT id, name, holiday_date, description, created_at, updated_at
     FROM library_holidays
     WHERE id = ?`,
    [holidayId],
  );
  return holiday;
};

const deleteHoliday = async (holidayId, userId, conn = db) => {
  const [result] = await conn.query(
    `UPDATE library_holidays
     SET is_active = 0, updated_by = ?
     WHERE id = ? AND is_active = 1`,
    [userId ?? null, holidayId],
  );
  return result.affectedRows;
};

const listAcademicPrograms = async ({ activeOnly = true } = {}, conn = db) => {
  const [rows] = await conn.query(
    `SELECT id, name, is_active, created_at, updated_at
     FROM academic_programs
     ${activeOnly ? "WHERE is_active = 1" : ""}
     ORDER BY name ASC`,
  );
  return rows;
};

const createAcademicProgram = async ({ name }, userId, conn = db) => {
  const [result] = await conn.query(
    "INSERT INTO academic_programs (name, created_by, updated_by) VALUES (?, ?, ?)",
    [name, userId ?? null, userId ?? null],
  );
  const [[program]] = await conn.query(
    "SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?",
    [result.insertId],
  );
  return program;
};

const updateAcademicProgram = async (programId, name, userId, conn = db) => {
  const [result] = await conn.query(
    "UPDATE academic_programs SET name = ?, updated_by = ? WHERE id = ? AND is_active = 1",
    [name, userId ?? null, programId],
  );
  if (!result.affectedRows) return null;
  const [[program]] = await conn.query(
    "SELECT id, name, is_active, created_at, updated_at FROM academic_programs WHERE id = ?",
    [programId],
  );
  return program;
};

const deleteAcademicProgram = async (programId, userId, conn = db) => {
  const [result] = await conn.query(
    "UPDATE academic_programs SET is_active = 0, updated_by = ? WHERE id = ? AND is_active = 1",
    [userId ?? null, programId],
  );
  return result.affectedRows;
};

const listAcademicTerms = async (conn = db) => {
  const [rows] = await conn.query(
    "SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms ORDER BY starts_on DESC, id DESC",
  );
  return rows;
};

const createAcademicTerm = async ({ name, startsOn, endsOn, isCurrent }, userId, conn = db) => {
  if (isCurrent) {
    await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  }
  const [result] = await conn.query(
    "INSERT INTO academic_terms (name, starts_on, ends_on, is_current, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)",
    [name, startsOn, endsOn, isCurrent ? 1 : 0, userId ?? null, userId ?? null],
  );
  const [[term]] = await conn.query(
    "SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms WHERE id = ?",
    [result.insertId],
  );
  return term;
};

const updateAcademicTerm = async (termId, { name, startsOn, endsOn, isCurrent }, userId, conn = db) => {
  if (isCurrent) {
    await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1 AND id <> ?", [userId ?? null, termId]);
  }
  const [result] = await conn.query(
    "UPDATE academic_terms SET name = ?, starts_on = ?, ends_on = ?, is_current = ?, updated_by = ? WHERE id = ?",
    [name, startsOn, endsOn, isCurrent ? 1 : 0, userId ?? null, termId],
  );
  if (!result.affectedRows) return null;
  const [[term]] = await conn.query(
    "SELECT id, name, starts_on, ends_on, is_current, created_at, updated_at FROM academic_terms WHERE id = ?",
    [termId],
  );
  return term;
};

const deleteAcademicTerm = async (termId, conn = db) => {
  const [[term]] = await conn.query("SELECT id, is_current FROM academic_terms WHERE id = ?", [termId]);
  if (!term) return { term: null, usage: 0 };
  const [[usage]] = await conn.query("SELECT COUNT(*) AS total FROM users WHERE academic_term_id = ?", [termId]);
  if (usage.total) return { term, usage: Number(usage.total) };
  await conn.query("DELETE FROM academic_terms WHERE id = ?", [termId]);
  return { term, usage: 0 };
};

const setCurrentAcademicTerm = async (termId, userId, conn = db) => {
  const [[term]] = await conn.query("SELECT id FROM academic_terms WHERE id = ?", [termId]);
  if (!term) return false;
  await conn.query("UPDATE academic_terms SET is_current = 0, updated_by = ? WHERE is_current = 1", [userId ?? null]);
  await conn.query("UPDATE academic_terms SET is_current = 1, updated_by = ? WHERE id = ?", [userId ?? null, termId]);
  return true;
};

module.exports = {
  getSettings,
  updateSettings,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listAcademicPrograms,
  createAcademicProgram,
  updateAcademicProgram,
  deleteAcademicProgram,
  listAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
  setCurrentAcademicTerm,
};
