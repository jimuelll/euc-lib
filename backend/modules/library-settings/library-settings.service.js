const repository = require("./library-settings.repository");

const DEFAULT_SETTINGS = { overdue_fine_per_hour: 1 };

const normaliseSettings = (row) => ({
  overdue_fine_per_hour: Number(row?.overdue_fine_per_hour ?? DEFAULT_SETTINGS.overdue_fine_per_hour),
  updated_at: row?.updated_at ?? null,
});

const duplicateError = (message) => Object.assign(new Error(message), { status: 409 });

const getSettings = async (conn) => normaliseSettings(await repository.getSettings(conn));

const updateSettings = async ({ overdueFinePerHour }, updatedBy, conn) => {
  const numericRate = Number(overdueFinePerHour);
  if (!Number.isFinite(numericRate) || numericRate < 0) {
    throw Object.assign(new Error("Overdue fine per hour must be a non-negative number"), { status: 400 });
  }
  return normaliseSettings(await repository.updateSettings(numericRate.toFixed(2), updatedBy, conn));
};

const listHolidays = async (conn) => repository.listHolidays(conn);

const getHolidayDateSet = async (conn) => {
  const holidays = await listHolidays(conn);
  return new Set(holidays.map((holiday) => {
    const date = new Date(holiday.holiday_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }));
};

const createHoliday = async ({ name, holidayDate, description }, userId, conn) => {
  if (!name?.trim()) throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  if (!holidayDate?.trim()) throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  try {
    return await repository.createHoliday(
      { name: name.trim(), holidayDate: holidayDate.trim(), description: description?.trim() || null },
      userId,
      conn,
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw duplicateError("A holiday already exists for that date");
    throw error;
  }
};

const updateHoliday = async (holidayId, { name, holidayDate, description }, userId, conn) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  if (!name?.trim()) throw Object.assign(new Error("Holiday name is required"), { status: 400 });
  if (!holidayDate?.trim()) throw Object.assign(new Error("Holiday date is required"), { status: 400 });
  try {
    const holiday = await repository.updateHoliday(
      holidayId,
      { name: name.trim(), holidayDate: holidayDate.trim(), description: description?.trim() || null },
      userId,
      conn,
    );
    if (!holiday) throw Object.assign(new Error("Holiday not found"), { status: 404 });
    return holiday;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw duplicateError("A holiday already exists for that date");
    throw error;
  }
};

const deleteHoliday = async (holidayId, userId, conn) => {
  if (!Number.isInteger(holidayId) || holidayId < 1) throw Object.assign(new Error("Invalid holiday ID"), { status: 400 });
  const affectedRows = await repository.deleteHoliday(holidayId, userId, conn);
  if (!affectedRows) throw Object.assign(new Error("Holiday not found"), { status: 404 });
  return { success: true };
};

const listAcademicPrograms = async ({ activeOnly = true } = {}, conn) => repository.listAcademicPrograms({ activeOnly }, conn);

const createAcademicProgram = async ({ name }, userId, conn) => {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    return await repository.createAcademicProgram({ name: cleanedName }, userId, conn);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw duplicateError("This program / course already exists");
    throw error;
  }
};

const updateAcademicProgram = async (programId, { name }, userId, conn) => {
  const cleanedName = String(name || "").trim();
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  if (!cleanedName) throw Object.assign(new Error("Program / course name is required"), { status: 400 });
  try {
    const program = await repository.updateAcademicProgram(programId, cleanedName, userId, conn);
    if (!program) throw Object.assign(new Error("Program / course not found"), { status: 404 });
    return program;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw duplicateError("This program / course already exists");
    throw error;
  }
};

const deleteAcademicProgram = async (programId, userId, conn) => {
  if (!Number.isInteger(programId) || programId < 1) throw Object.assign(new Error("Invalid program / course"), { status: 400 });
  const affectedRows = await repository.deleteAcademicProgram(programId, userId, conn);
  if (!affectedRows) throw Object.assign(new Error("Program / course not found"), { status: 404 });
  return { success: true };
};

const listAcademicTerms = async (conn) => repository.listAcademicTerms(conn);

const validateTerm = ({ name, startsOn, endsOn }) => {
  if (!String(name || "").trim() || !startsOn || !endsOn) {
    throw Object.assign(new Error("Term name and dates are required"), { status: 400 });
  }
  if (new Date(startsOn) > new Date(endsOn)) {
    throw Object.assign(new Error("The end date must be after the start date"), { status: 400 });
  }
};

const createAcademicTerm = async ({ name, startsOn, endsOn, isCurrent }, userId, conn) => {
  validateTerm({ name, startsOn, endsOn });
  return repository.createAcademicTerm({ name: String(name).trim(), startsOn, endsOn, isCurrent }, userId, conn);
};

const updateAcademicTerm = async (termId, { name, startsOn, endsOn, isCurrent }, userId, conn) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  validateTerm({ name, startsOn, endsOn });
  const term = await repository.updateAcademicTerm(termId, { name: String(name).trim(), startsOn, endsOn, isCurrent }, userId, conn);
  if (!term) throw Object.assign(new Error("Academic term not found"), { status: 404 });
  return term;
};

const deleteAcademicTerm = async (termId, conn) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  const { term, usage } = await repository.deleteAcademicTerm(termId, conn);
  if (!term) throw Object.assign(new Error("Academic term not found"), { status: 404 });
  if (term.is_current) throw Object.assign(new Error("Set another term as current before deleting this term"), { status: 409 });
  if (usage) throw Object.assign(new Error("This term is assigned to user records and cannot be deleted"), { status: 409 });
  return { success: true };
};

const setCurrentAcademicTerm = async (termId, userId, conn) => {
  if (!Number.isInteger(termId) || termId < 1) throw Object.assign(new Error("Invalid academic term"), { status: 400 });
  const updated = await repository.setCurrentAcademicTerm(termId, userId, conn);
  if (!updated) throw Object.assign(new Error("Academic term not found"), { status: 404 });
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
  updateAcademicTerm,
  deleteAcademicTerm,
  setCurrentAcademicTerm,
};
