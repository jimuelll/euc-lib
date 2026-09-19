const repository = require("./borrowing.repository");
const { calculateDueDateWithHolidays, syncOverdueBorrowings } = require("./overdue.helper");
const notificationsService = require("../notifications/notifications.service");
const { assertEligible } = require("../clearance/clearance.service");
const { calculateLoanDueDate } = require("./loan-duration");
const fineLedger = require("./fine-ledger.service");

const borrowBook = async (
  userId,
  bookIdOrCopyBarcode,
  issuedBy,
  { isCopyBarcode = false, ipAddress = null, reservationId = null } = {},
) => {
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    await assertEligible(userId, conn);

    let copy;
    if (isCopyBarcode) {
      const candidate = await repository.findCopyForBorrow(bookIdOrCopyBarcode, conn);
      if (!candidate) throw Object.assign(new Error("Copy barcode not found"), { status: 404 });
      if (candidate.material_type === "thesis") throw Object.assign(new Error("Theses are reference-only and cannot be borrowed"), { status: 409 });
      if (!candidate.is_active) throw Object.assign(new Error("This copy is not available"), { status: 409 });
      if (candidate.condition === "lost") throw Object.assign(new Error("This copy is marked lost and cannot be borrowed"), { status: 409 });
      copy = candidate;
    } else {
      const book = await repository.findBookForBorrow(bookIdOrCopyBarcode, conn);
      if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
      if (book.material_type === "thesis") throw Object.assign(new Error("Theses are reference-only and cannot be borrowed"), { status: 409 });
      if (!book.loan_duration_minutes) throw Object.assign(new Error("This book has no active loan policy"), { status: 409 });
      const candidate = await repository.findAvailableCopyForBook(bookIdOrCopyBarcode, conn);
      if (!candidate) throw Object.assign(new Error("No copies available"), { status: 409 });
      copy = {
        ...candidate,
        book_id: bookIdOrCopyBarcode,
        default_borrow_days: book.default_borrow_days,
        loan_duration_minutes: book.loan_duration_minutes,
        loan_duration_unit: book.loan_duration_unit,
        fine_per_hour: book.fine_per_hour,
        fine_interval: book.fine_interval,
        initial_fine: book.initial_fine,
      };
    }

    const readyHold = await repository.findReadyHoldByCopy(copy.id, conn);
    if (readyHold && reservationId !== readyHold.id) {
      throw Object.assign(new Error("This copy is reserved for a patron awaiting pickup"), { status: 409 });
    }
    if (await repository.findActiveBorrowingByCopy(copy.id, conn)) {
      throw Object.assign(new Error("This copy is already borrowed"), { status: 409 });
    }
    if (await repository.findActiveBorrowingByUserBook(userId, copy.book_id, conn)) {
      throw Object.assign(new Error("User already has this book borrowed"), { status: 409 });
    }

    if (reservationId !== null) {
      const reservation = await repository.findReadyReservation(reservationId, userId, copy.book_id, conn);
      if (!reservation) throw Object.assign(new Error("This ready reservation does not match the patron and selected copy"), { status: 409 });
      if (reservation.reserved_copy_id !== copy.id) throw Object.assign(new Error("The selected copy is not the copy prepared for this reservation"), { status: 409 });
    }

    const durationMinutes = Number(copy.loan_duration_minutes);
    const durationUnit = copy.loan_duration_unit;
    const dueDate = await calculateLoanDueDate(new Date(), { minutes: durationMinutes, unit: durationUnit }, conn);
    const borrowingId = await repository.createBorrowing({
      userId,
      bookId: copy.book_id,
      copyId: copy.id,
      dueDate,
      durationMinutes,
      durationUnit,
      finePerHour: copy.fine_per_hour,
      fineInterval: copy.fine_interval,
      initialFine: copy.initial_fine,
      issuedBy,
    }, conn);
    await conn.query("INSERT INTO fine_accounts (borrowing_id) VALUES (?)", [borrowingId]);
    if (reservationId !== null) await repository.fulfillReservation(reservationId, conn);
    await conn.commit();

    const target = await repository.getBorrowingNotificationTarget(borrowingId);
    if (target) {
      await notificationsService.createNotification({
        type: "borrowing_created",
        title: "Book borrowed successfully",
        body: `You borrowed "${target.title}". Please return it on or before ${new Date(dueDate).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: target.user_id,
        createdBy: issuedBy ?? null,
      });
    }

    return { borrowingId, copyId: copy.id, barcode: copy.barcode, dueDate, warning: copy.condition === "damaged" ? "This copy is marked damaged; please handle it with care." : null };
  } catch (error) {
    await conn.rollback();
    if (error?.code === "ER_DUP_ENTRY" && /uq_borrowings_active_(copy|user_book)/.test(String(error.message))) {
      throw Object.assign(new Error("This copy is no longer available for checkout"), { status: 409 });
    }
    throw error;
  } finally {
    conn.release();
  }
};

const returnBook = async (borrowingId, userId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const row = await repository.getBorrowingForReturn(borrowingId, conn);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.user_id !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
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
        createdBy: userId ?? null,
      });
    }
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = { borrowBook, returnBook };
