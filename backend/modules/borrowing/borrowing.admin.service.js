const repository = require("./borrowing.repository");
const { mapBorrowingsWithFineDetails, syncOverdueBorrowings } = require("./overdue.helper");

const adminDeleteBorrowing = async (borrowingId, deletedBy) => {
  const row = await repository.getAdminBorrowing(borrowingId);
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  if (["borrowed", "overdue"].includes(row.status)) {
    throw Object.assign(new Error("Cannot delete an active borrowing — return the book first"), { status: 409 });
  }
  await repository.archiveBorrowing(borrowingId, deletedBy);
};

const adminRestoreBorrowing = async (borrowingId) => {
  if (!await repository.getArchivedBorrowing(borrowingId)) {
    throw Object.assign(new Error("Archived borrowing record not found"), { status: 404 });
  }
  await repository.restoreBorrowing(borrowingId);
};

const adminGetBorrowings = async (options) => {
  await syncOverdueBorrowings();
  const result = await repository.getAdminBorrowings(options);
  return {
    rows: await mapBorrowingsWithFineDetails(result.rows),
    total: result.total,
    page: result.page,
    totalPages: Math.ceil(result.total / result.limit),
    summary: {
      total_records: Number(result.summary?.total_records ?? 0),
      borrowed_count: Number(result.summary?.borrowed_count ?? 0),
      overdue_count: Number(result.summary?.overdue_count ?? 0),
      returned_count: Number(result.summary?.returned_count ?? 0),
      unique_borrowers: Number(result.summary?.unique_borrowers ?? 0),
    },
  };
};

module.exports = { adminDeleteBorrowing, adminRestoreBorrowing, adminGetBorrowings };
