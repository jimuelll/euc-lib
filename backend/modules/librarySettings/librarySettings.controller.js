const service = require("./librarySettings.service");

const getLibrarySettings = async (req, res) => {
  try {
    const [settings, holidays] = await Promise.all([
      service.getSettings(),
      service.listHolidays(),
    ]);

    res.json({ settings, holidays });
  } catch (error) {
    console.error("[library-settings] getLibrarySettings:", error);
    res.status(500).json({ message: "Failed to fetch library settings" });
  }
};

const updateLibrarySettings = async (req, res) => {
  try {
    const settings = await service.updateSettings(
      { overdueFinePerHour: req.body?.overdue_fine_per_hour },
      req.user?.id
    );

    res.json({ message: "Library settings updated successfully", settings });
  } catch (error) {
    console.error("[library-settings] updateLibrarySettings:", error);
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

    res.status(201).json({ message: "Holiday added successfully", holiday });
  } catch (error) {
    console.error("[library-settings] createHoliday:", error);
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

    res.json({ message: "Holiday updated successfully", holiday });
  } catch (error) {
    console.error("[library-settings] updateHoliday:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update holiday" });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const holidayId = Number.parseInt(req.params.holidayId, 10);
    await service.deleteHoliday(holidayId, req.user?.id);
    res.json({ message: "Holiday removed successfully" });
  } catch (error) {
    console.error("[library-settings] deleteHoliday:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to remove holiday" });
  }
};

const listAcademicPrograms = async (req, res) => {
  try {
    const programs = await service.listAcademicPrograms();
    res.json({ programs });
  } catch (error) {
    console.error("[library-settings] listAcademicPrograms:", error);
    res.status(500).json({ message: "Failed to fetch programs / courses" });
  }
};

const createAcademicProgram = async (req, res) => {
  try {
    const program = await service.createAcademicProgram({ name: req.body?.name }, req.user?.id);
    res.status(201).json({ message: "Program / course added", program });
  } catch (error) {
    console.error("[library-settings] createAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add program / course" });
  }
};

const updateAcademicProgram = async (req, res) => {
  try {
    const program = await service.updateAcademicProgram(Number.parseInt(req.params.programId, 10), { name: req.body?.name }, req.user?.id);
    res.json({ message: "Program / course updated", program });
  } catch (error) {
    console.error("[library-settings] updateAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update program / course" });
  }
};

const deleteAcademicProgram = async (req, res) => {
  try {
    await service.deleteAcademicProgram(Number.parseInt(req.params.programId, 10), req.user?.id);
    res.json({ message: "Program / course removed" });
  } catch (error) {
    console.error("[library-settings] deleteAcademicProgram:", error);
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to remove program / course" });
  }
};

const listAcademicTerms = async (_req, res) => { try { res.json({ terms: await service.listAcademicTerms() }); } catch (error) { res.status(500).json({ message: "Failed to fetch academic terms" }); } };
const createAcademicTerm = async (req, res) => { try { const term = await service.createAcademicTerm({ name: req.body?.name, startsOn: req.body?.starts_on, endsOn: req.body?.ends_on, isCurrent: Boolean(req.body?.is_current) }, req.user?.id); res.status(201).json({ message: "Academic term added", term }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add academic term" }); } };
const setCurrentAcademicTerm = async (req, res) => { try { await service.setCurrentAcademicTerm(Number.parseInt(req.params.termId, 10), req.user?.id); res.json({ message: "Current academic term updated" }); } catch (error) { res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update academic term" }); } };

module.exports = {
  getLibrarySettings,
  updateLibrarySettings,
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
