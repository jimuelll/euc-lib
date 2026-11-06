import overdue = require("./overdue.helper");
import clearance = require("../clearance/clearance.service");
import catalogSettings = require("../catalog/catalog.settings.service");
import loanDuration = require("./loan-duration");

const repository = require("./borrowing.repository");

const searchCatalogueWithAvailability = async (query: string) => {
  await overdue.syncOverdueBorrowings();
  const settings = await catalogSettings.getCatalogSettings();
  return repository.searchCatalogueWithAvailability(query, { showUnheldInOpac: settings.show_unheld_in_opac });
};

const resolveUserByBarcode = (scannedValue: string) => repository.findUserByBarcode(scannedValue);
const resolveCopyByBarcode = async (barcode: string) => {
  const copy = await repository.findCopyByBarcode(barcode);
  if (!copy) return null;
  return { ...copy, due_date_preview: copy.loan_duration_minutes && copy.loan_duration_unit
    ? await loanDuration.calculateLoanDueDate(new Date(), { minutes: copy.loan_duration_minutes, unit: copy.loan_duration_unit })
    : null };
};
const getActiveBorrowingByCopyBarcode = (barcode: string) => repository.findActiveBorrowingByCopyBarcode(barcode);
const getReturnPreviewByIdentifier = async (identifier: string) => {
  await overdue.syncOverdueBorrowings();
  return repository.findReturnPreviewByIdentifier(identifier.trim());
};

const lookupUserWithBorrows = async (scannedValue: string) => {
  // Accept the attendance QR value (users.barcode) as well as the student/employee ID.
  const patron = await repository.findUserByBarcode(scannedValue);
  const studentEmployeeId = patron?.student_employee_id ?? scannedValue;
  const result = await repository.findUserWithActiveBorrows(studentEmployeeId);
  if (!result) return null;
  const clearanceProfile = await clearance.getClearanceProfile(studentEmployeeId);
  return {
    user: result.user,
    activeBorrows: await overdue.mapBorrowingsWithFineDetails(result.activeBorrows),
    clearance: clearanceProfile,
  };
};

export = {
  searchCatalogueWithAvailability,
  resolveUserByBarcode,
  resolveCopyByBarcode,
  getActiveBorrowingByCopyBarcode,
  getReturnPreviewByIdentifier,
  lookupUserWithBorrows,
};
