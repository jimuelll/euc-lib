const service = require("./library-settings.service");
const { logError } = require("../../logger");

const getLibrarySettings = async (req, res) => {
  try {
    const [settings, holidays] = await Promise.all([
      service.getSettings(),
      service.listHolidays({ status: req.query?.holidays === "all" ? "all" : req.query?.holidays === "archived" ? "archived" : "active" }),
    ]);

    res.json({ settings, holidays });
  } catch (error) {
    logError("[library-settings] getLibrarySettings:", error);
    res.status(500).json({ message: "Failed to fetch library settings" });
  }
};

const updateLibrarySettings = async (req, res) => {
  try {
    const settings = await service.updateSettings(
      { overdueFinePerHour: req.body?.overdue_fine_per_hour },
      req.user?.id
    );

    res.locals.auditEnqueued = true;
    res.json({ message: "Library settings updated successfully", settings });
  } catch (error) {
    logError("[library-settings] updateLibrarySettings:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update settings" });
  }
};

const createHoliday = async (req, res) => {
  try {
    const holiday = await service.createHoliday(
      {
        name: req.body?.name,
        holidayDate: req.body?.holiday_date,
        description: req.body?.description,
      },
      req.user?.id
    );

    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Holiday added successfully", holiday });
  } catch (error) {
    logError("[library-settings] createHoliday:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to create holiday" });
  }
};

const updateHoliday = async (req, res) => {
  try {
    const holidayId = Number.parseInt(req.params.holidayId, 10);
    const holiday = await service.updateHoliday(
      holidayId,
      {
        name: req.body?.name,
        holidayDate: req.body?.holiday_date,
        description: req.body?.description,
      },
      req.user?.id
    );

    res.locals.auditEnqueued = true;
    res.json({ message: "Holiday updated successfully", holiday });
  } catch (error) {
    logError("[library-settings] updateHoliday:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update holiday" });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const holidayId = Number.parseInt(req.params.holidayId, 10);
    const result = await service.deleteHoliday(holidayId, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Holiday archived. Its saved due dates remain unchanged." });
  } catch (error) {
    logError("[library-settings] deleteHoliday:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to remove holiday" });
  }
};

const restoreHoliday = async (req, res) => {
  try {
    const result = await service.restoreHoliday(Number.parseInt(req.params.holidayId, 10), req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Holiday restored" });
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to restore holiday" });
  }
};

const listAcademicPrograms = async (req, res) => {
  try {
    const status = ["active", "archived", "all"].includes(req.query?.status) ? req.query.status : "active";
    const programs = await service.listAcademicPrograms({ status });
    res.json({ programs });
  } catch (error) {
    logError("[library-settings] listAcademicPrograms:", error);
    res.status(500).json({ message: "Failed to fetch programs / courses" });
  }
};

const createAcademicProgram = async (req, res) => {
  try {
    const program = await service.createAcademicProgram({ name: req.body?.name }, req.user?.id);
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Program / course added", program });
  } catch (error) {
    logError("[library-settings] createAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add program / course" });
  }
};

const updateAcademicProgram = async (req, res) => {
  try {
    const program = await service.updateAcademicProgram(Number.parseInt(req.params.programId, 10), { name: req.body?.name }, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Program / course updated", program });
  } catch (error) {
    logError("[library-settings] updateAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update program / course" });
  }
};

const deleteAcademicProgram = async (req, res) => {
  try {
    const result = await service.deleteAcademicProgram(Number.parseInt(req.params.programId, 10), req.user?.id);
    res.locals.auditEnqueued = true;
    res.locals.auditDetails = { affectedCount: result.reference_count, action: result.action };
    res.json({ ...result, message: result.action === "deleted" ? "Unused program / course permanently deleted" : "Program / course archived because records still reference it" });
  } catch (error) {
    logError("[library-settings] deleteAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to remove program / course" });
  }
};

const restoreAcademicProgram = async (req, res) => {
  try {
    const result = await service.restoreAcademicProgram(Number.parseInt(req.params.programId, 10), req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Program / course restored" });
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to restore program / course" });
  }
};

const listDepartments = async (req, res) => { try { const status = ["active", "archived", "all"].includes(req.query?.status) ? req.query.status : "active"; res.json({ departments: await service.listDepartments({ status }) }); } catch { res.status(500).json({ message: "Failed to fetch departments" }); } };
const createDepartment = async (req, res) => { try { const department = await service.createDepartment({ name: req.body?.name }, req.user?.id); res.locals.auditEnqueued = true; res.status(201).json({ message: "Department added", department }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add department" }); } };
const updateDepartment = async (req, res) => { try { const department = await service.updateDepartment(Number.parseInt(req.params.departmentId, 10), { name: req.body?.name }, req.user?.id); res.locals.auditEnqueued = true; res.json({ message: "Department updated", department }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update department" }); } };
const deleteDepartment = async (req, res) => { try { const result = await service.deleteDepartment(Number.parseInt(req.params.departmentId, 10), req.user?.id); res.locals.auditEnqueued = true; res.json({ ...result, message: result.action === "deleted" ? "Unused department permanently deleted" : "Department archived because employee records still reference it" }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to remove department" }); } };
const restoreDepartment = async (req, res) => { try { const result = await service.restoreDepartment(Number.parseInt(req.params.departmentId, 10), req.user?.id); res.locals.auditEnqueued = true; res.json({ ...result, message: "Department restored" }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to restore department" }); } };
const listAcademicTerms = async (_req, res) => { try { res.json({ terms: await service.listAcademicTerms() }); } catch (error) { res.status(500).json({ message: "Failed to fetch academic terms" }); } };
const createAcademicTerm = async (req, res) => { try { const term = await service.createAcademicTerm({ name: req.body?.name, startsOn: req.body?.starts_on, endsOn: req.body?.ends_on, isCurrent: Boolean(req.body?.is_current) }, req.user?.id); res.locals.auditEnqueued = true; res.status(201).json({ message: "Academic term added", term }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add academic term" }); } };
const updateAcademicTerm = async (req, res) => { try { const term = await service.updateAcademicTerm(Number.parseInt(req.params.termId, 10), { name: req.body?.name, startsOn: req.body?.starts_on, endsOn: req.body?.ends_on, isCurrent: Boolean(req.body?.is_current) }, req.user?.id); res.locals.auditEnqueued = true; res.json({ message: "Academic term updated", term }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update academic term" }); } };
const deleteAcademicTerm = async (req, res) => { try { await service.deleteAcademicTerm(Number.parseInt(req.params.termId, 10), req.user?.id); res.locals.auditEnqueued = true; res.json({ message: "Academic term deleted" }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to delete academic term" }); } };
const setCurrentAcademicTerm = async (req, res) => { try { await service.setCurrentAcademicTerm(Number.parseInt(req.params.termId, 10), req.user?.id); res.locals.auditEnqueued = true; res.json({ message: "Current academic term updated" }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update academic term" }); } };

module.exports = {
  getLibrarySettings,
  updateLibrarySettings,
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
