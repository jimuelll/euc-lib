const repository = require("./circulation.repository");
const { borrowBook } = require("../borrowing/borrowing.transaction.service");
const { syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const { calculateLoanDueDate } = require("../borrowing/loan-duration");
const fineLedger = require("../borrowing/fine-ledger.service");
const notificationsService = require("../notifications/notifications.service");
const { getClearanceProfile } = require("../clearance/clearance.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

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
  const { copyId: _copyId, ...result } = await borrowBook(userId, bookId, issuedBy, { auditRoute: "/api/admin/circulation/borrow" });
  return { message: "Book borrowed successfully", ...result };
};

const processReturn = async (borrowingId, returnedBy = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const row = await repository.getBorrowingForReturn(borrowingId, conn);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.status === "returned") throw Object.assign(new Error("Book already returned"), { status: 409 });
    const changed = await repository.markReturned(borrowingId, conn);
    if (changed !== 1) throw Object.assign(new Error("This loan changed while the return was being processed. Reload and try again."), { status: 409 });
    const [[returned]] = await conn.query("SELECT returned_at FROM borrowings WHERE id = ?", [borrowingId]);
    await fineLedger.assessBorrowing({ ...row, returned_at: returned.returned_at }, conn);
    const target = await repository.getBorrowingNotificationTarget(borrowingId, conn);
    if (target) await notificationsService.enqueueNotification(conn, {
      type: "borrowing_returned", title: "Book return recorded",
      body: `Your return for "${target.title}" has been recorded successfully.`,
      href: "/my-library", audienceType: "user", audienceUserId: target.user_id,
    });
    const copyDescription = `Returned “${row.title}” · ${copyLabel(row)}`;
    await enqueueTransactionalAudit(conn, {
      actorId: returnedBy,
      category: "borrowing",
      route: "/api/admin/circulation/return",
      action: "returned",
      description: copyDescription,
      before: row,
      after: { ...row, status: "returned", returned_at: returned.returned_at },
      type: "state_transition",
      details: { stateFrom: row.status, stateTo: "returned", stateLabel: "Loan status", borrowingId },
      extraMetadata: { borrowing_id: borrowingId, copy_barcode: row.barcode, copy_display_description: copyDescription },
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const processRenew = async ({ borrowingId, renewedBy = null }) => {
  const connection = await repository.getConnection();
  let dueDate;
  try {
    await connection.beginTransaction();
    const row = await repository.getBorrowingForRenewal(borrowingId, connection);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.status === "returned") throw Object.assign(new Error("Cannot renew a returned book"), { status: 409 });
    if (!row.has_active_policy) throw Object.assign(new Error("This book needs an active loan policy before it can be renewed"), { status: 409 });
    if (!Number.isInteger(Number(row.loan_duration_minutes)) || !["day", "hour"].includes(row.loan_duration_unit)) {
      throw Object.assign(new Error("This loan has no saved renewal duration. Ask an administrator to review the borrowing record."), { status: 409 });
    }
    dueDate = await calculateLoanDueDate(new Date(), {
      minutes: Number(row.loan_duration_minutes),
      unit: row.loan_duration_unit,
    }, connection);
    await fineLedger.beginRenewalCycle(borrowingId, connection);
    const changed = await repository.renewBorrowing(borrowingId, dueDate, connection);
    if (changed !== 1) throw Object.assign(new Error("This loan changed while renewal was being processed. Reload and try again."), { status: 409 });
    await notificationsService.enqueueNotification(connection, {
      type: "borrowing_renewed", title: "Book renewal recorded",
      body: `Your borrowing for "${row.title}" has been renewed. New due date: ${new Date(dueDate).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      href: "/my-library", audienceType: "user", audienceUserId: row.user_id, createdBy: renewedBy,
    });
    const [[savedBorrowing]] = await connection.query("SELECT id, status, due_date FROM borrowings WHERE id = ?", [borrowingId]);
    await enqueueTransactionalAudit(connection, {
      actorId: renewedBy,
      category: "borrowing",
      route: "/api/admin/circulation/renew",
      action: "renewed",
      description: `Renewed “${row.title}” · borrowing ${borrowingId}`,
      before: row,
      after: savedBorrowing,
      type: "state_transition",
      details: { stateFrom: row.due_date, stateTo: savedBorrowing.due_date, stateLabel: "Due date", borrowingId },
      extraMetadata: { borrowing_id: borrowingId },
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { message: "Book renewed successfully", dueDate };
};

const getCirculationLog = async (options) => {
  await syncOverdueBorrowings();
  const result = await repository.getCirculationLog(options);
  return { rows: result.rows, total: result.total, page: options.page, totalPages: Math.ceil(result.total / options.limit) };
};

module.exports = { lookupUser, lookupBook, processBorrow, processReturn, processRenew, getCirculationLog };
