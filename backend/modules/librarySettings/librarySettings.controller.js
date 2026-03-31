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

module.exports = {
  getLibrarySettings,
  updateLibrarySettings,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
