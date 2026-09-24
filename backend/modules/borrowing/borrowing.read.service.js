const { mapBorrowingsWithFineDetails, syncOverdueBorrowings } = require("./overdue.helper");
const repository = require("./borrowing.repository");
const { getClearanceProfile } = require("../clearance/clearance.service");
const { getPagination } = require("./borrowing.helpers");
const catalogSettings = require("../catalog/catalog.settings.service");

const getActiveBorrows = async (userId) => {
  await syncOverdueBorrowings();
  return mapBorrowingsWithFineDetails(await repository.findActiveBorrows(userId));
};

const getBorrowHistory = async (userId, { page, limit } = {}) => {
  const { paged, safePage, safeLimit, offset } = getPagination({ page, limit });
  const total = paged ? await repository.countBorrowHistory(userId) : 0;
  const rows = await repository.findBorrowHistory(userId, paged ? { limit: safeLimit, offset } : {});
  return paged
    ? { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } }
    : rows;
};

const searchCatalogueWithAvailability = async (query) => {
  await syncOverdueBorrowings();
  const settings = await catalogSettings.getCatalogSettings();
  return repository.searchCatalogueWithAvailability(query, { showUnheldInOpac: settings.show_unheld_in_opac });
};

const resolveUserByBarcode = (scannedValue) => repository.findUserByBarcode(scannedValue);
const resolveCopyByBarcode = (barcode) => repository.findCopyByBarcode(barcode);
const getActiveBorrowingByCopyBarcode = (barcode) => repository.findActiveBorrowingByCopyBarcode(barcode);

const lookupUserWithBorrows = async (studentEmployeeId) => {
  const result = await repository.findUserWithActiveBorrows(studentEmployeeId);
  if (!result) return null;
  const clearance = await getClearanceProfile(studentEmployeeId);
  return {
    user: result.user,
    activeBorrows: await mapBorrowingsWithFineDetails(result.activeBorrows),
    clearance,
  };
};

module.exports = {
  getActiveBorrows,
  getBorrowHistory,
  searchCatalogueWithAvailability,
  resolveUserByBarcode,
  resolveCopyByBarcode,
  getActiveBorrowingByCopyBarcode,
  lookupUserWithBorrows,
};
