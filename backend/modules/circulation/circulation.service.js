const repository = require("./circulation.repository");
const { borrowBook } = require("../borrowing/borrowing.transaction.service");
const { syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const { calculateLoanDueDate } = require("../borrowing/loan-duration");
const fineLedger = require("../borrowing/fine-ledger.service");
const notificationsService = require("../notifications/notifications.service");
const { getClearanceProfile } = require("../clearance/clearance.service");

const lookupUser = async (studentEmployeeId) => {
  const user = await repository.findUser(studentEmployeeId.trim());
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (!user.is_active) throw Object.assign(new Error("User account is inactive"), { status: 403 });
  await syncOverdueBorrowings();
  const activeBorrows = await repository.findActiveBorrows(user.id);
  const clearance = await getClearanceProfile(studentEmployeeId);
  return { user, activeBorrows, clearance };
};

const lookupBook = async (isbn) => {
  const book = await repository.findBookByIsbn(String(isbn).replace(/[\s-]/g, "").toUpperCase());
  if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
  if (book.material_type !== "book") {
    throw Object.assign(new Error("This thesis is reference-only and cannot be circulated"), { status: 409, materialType: book.material_type });
  }
  return book;
};

const processBorrow = async ({ userId, bookId, issuedBy }) => {
  const { copyId: _copyId, ...result } = await borrowBook(userId, bookId, issuedBy);
  return { message: "Book borrowed successfully", ...result };
};

const processReturn = async (borrowingId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const row = await repository.getBorrowingForReturn(borrowingId, conn);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.status === "returned") throw Object.assign(new Error("Book already returned"), { status: 409 });
    await repository.markReturned(borrowingId, conn);
    const [[returned]] = await conn.query("SELECT returned_at FROM borrowings WHERE id = ?", [borrowingId]);
    await fineLedger.assessBorrowing({ ...row, returned_at: returned.returned_at }, conn);
    await conn.commit();

    const target = await repository.getBorrowingNotificationTarget(borrowingId);
    if (target) {
      await notificationsService.createNotification({
        type: "borrowing_returned",
        title: "Book return recorded",
        body: `Your return for "${target.title}" has been recorded successfully.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: null,
      });
    }
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const processRenew = async ({ borrowingId, renewedBy = null }) => {
  const row = await repository.getBorrowingForRenewal(borrowingId);
  if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  if (row.status === "returned") throw Object.assign(new Error("Cannot renew a returned book"), { status: 409 });
  const dueDate = await calculateLoanDueDate(new Date(), { minutes: row.loan_duration_minutes || Math.max(1, Number.parseInt(row.default_borrow_days, 10) || 7) * 1440, unit: row.loan_duration_unit || "day" });
  const connection = await repository.getConnection();
  try { await connection.beginTransaction(); await fineLedger.beginRenewalCycle(borrowingId, connection); await connection.commit(); } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  await repository.renewBorrowing(borrowingId, dueDate);

  const target = await repository.getBorrowingNotificationTarget(borrowingId);
  if (target) {
    await notificationsService.createNotification({
      type: "borrowing_renewed",
      title: "Book renewal recorded",
      body: `Your borrowing for "${target.title}" has been renewed. New due date: ${new Date(dueDate).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: target.user_id,
      createdBy: renewedBy,
    });
  }
  return { message: "Book renewed successfully", dueDate };
};

const getCirculationLog = async (options) => {
  await syncOverdueBorrowings();
  const result = await repository.getCirculationLog(options);
  return { rows: result.rows, total: result.total, page: options.page, totalPages: Math.ceil(result.total / options.limit) };
};

module.exports = { lookupUser, lookupBook, processBorrow, processReturn, processRenew, getCirculationLog };
