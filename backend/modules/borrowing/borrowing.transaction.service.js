const repository = require("./borrowing.repository");
const { calculateDueDateWithHolidays, syncOverdueBorrowings } = require("./overdue.helper");
const notificationsService = require("../notifications/notifications.service");
const { assertEligible } = require("../clearance/clearance.service");
const { calculateLoanDueDate } = require("./loan-duration");
const fineLedger = require("./fine-ledger.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

const borrowBook = async (
  userId,
  bookIdOrCopyBarcode,
  issuedBy,
  { isCopyBarcode = false, ipAddress = null, reservationId = null, auditRoute = null } = {},
) => {
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    await assertEligible(userId, conn);

    let copy;
    if (isCopyBarcode) {
      const identity = await repository.findCopyBookIdentityForBorrow(bookIdOrCopyBarcode, conn);
      if (!identity) throw Object.assign(new Error("Copy barcode or accession number not found"), { status: 404 });
      // Lock in the same order as count changes and reservation preparation:
      // book first, then the physical copy.
      const book = await repository.findBookForBorrow(identity.book_id, conn);
      if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
      if (book.material_type === "thesis") throw Object.assign(new Error("Theses are reference-only and cannot be borrowed"), { status: 409 });
      if (!book.loan_duration_minutes) throw Object.assign(new Error("This book has no active loan policy"), { status: 409 });
      const candidate = await repository.findCopyForBorrow(bookIdOrCopyBarcode, conn);
      if (!candidate) throw Object.assign(new Error("Copy barcode not found"), { status: 404 });
      if (!candidate.has_active_policy) throw Object.assign(new Error("This book needs an active loan policy before it can be borrowed"), { status: 409 });
      if (Number(candidate.book_id) !== Number(book.id)) {
        throw Object.assign(new Error("The copy identifier resolved to another catalog record. Reload and try again."), { status: 409 });
      }
      if (candidate.accession_voided) throw Object.assign(new Error("This accession has been voided and this copy cannot be borrowed. Add a new physical copy with the correct accession."), { status: 409 });
      if (!String(candidate.accession_number ?? "").trim()) throw Object.assign(new Error("This copy has no accession number and cannot be borrowed. Add its holding first."), { status: 409 });
      if (!candidate.is_active) throw Object.assign(new Error("This copy is not available"), { status: 409 });
      if (!["good", "damaged"].includes(candidate.condition)) throw Object.assign(new Error("This copy is not in a lendable condition"), { status: 409 });
      copy = {
        ...candidate,
        loan_policy_id_snapshot: book.loan_policy_id_snapshot,
        loan_policy_name_snapshot: book.loan_policy_name_snapshot,
        default_borrow_days: book.default_borrow_days,
        loan_duration_minutes: book.loan_duration_minutes,
        loan_duration_unit: book.loan_duration_unit,
        fine_per_hour: book.fine_per_hour,
        fine_interval: book.fine_interval,
        initial_fine: book.initial_fine,
      };
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
        title: book.title,
        loan_policy_id_snapshot: book.loan_policy_id_snapshot,
        loan_policy_name_snapshot: book.loan_policy_name_snapshot,
        default_borrow_days: book.default_borrow_days,
        loan_duration_minutes: book.loan_duration_minutes,
        loan_duration_unit: book.loan_duration_unit,
        fine_per_hour: book.fine_per_hour,
        fine_interval: book.fine_interval,
        initial_fine: book.initial_fine,
      };
    }

    const readyHold = await repository.findReadyHoldByCopy(copy.id, conn);
    let reservationToFulfill = null;
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
      reservationToFulfill = await repository.findReadyReservation(reservationId, userId, copy.book_id, conn);
      if (!reservationToFulfill) throw Object.assign(new Error("This ready reservation does not match the patron and selected copy"), { status: 409 });
      if (reservationToFulfill.reserved_copy_id !== copy.id) throw Object.assign(new Error("The selected copy is not the copy prepared for this reservation"), { status: 409 });
    } else {
      const pendingReservations = await repository.countPendingReservationsForBook(copy.book_id, conn);
      const copiesLeftForPreparation = await repository.countAvailableCopiesForBook(copy.book_id, copy.id, conn);
      if (copiesLeftForPreparation < pendingReservations) {
        throw Object.assign(
          new Error(`This checkout would leave ${copiesLeftForPreparation} borrowable cop${copiesLeftForPreparation === 1 ? "y" : "ies"} for ${pendingReservations} pending reservation${pendingReservations === 1 ? "" : "s"}. Prepare or cancel the pending reservation${pendingReservations === 1 ? "" : "s"} first.`),
          { status: 409, pendingReservations, copiesLeftForPreparation },
        );
      }
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
      loanPolicyIdSnapshot: copy.loan_policy_id_snapshot,
      loanPolicyNameSnapshot: copy.loan_policy_name_snapshot,
    }, conn);
    await conn.query("INSERT INTO fine_accounts (borrowing_id) VALUES (?)", [borrowingId]);
    if (reservationId !== null) {
      const fulfilled = await repository.fulfillReadyReservationAfterCheckout(reservationId, conn);
      if (fulfilled !== 1) {
        throw Object.assign(new Error("This reservation expired or changed before checkout completed. Reload the reservation before trying again."), { status: 409 });
      }
      const [[savedReservation]] = await conn.query(
        `SELECT r.id, r.status, r.book_id, r.reserved_copy_id, bk.title, bc.barcode
           FROM reservations r JOIN books bk ON bk.id = r.book_id
           LEFT JOIN book_copies bc ON bc.id = r.reserved_copy_id WHERE r.id = ?`,
        [reservationId],
      );
      await enqueueTransactionalAudit(conn, {
        actorId: issuedBy,
        category: "reservation",
        route: `/api/admin/reservations/${reservationId}/fulfill`,
        action: "fulfilled",
        description: `Fulfilled reservation for “${savedReservation.title}” · ${copyLabel(savedReservation)}`,
        before: { id: reservationToFulfill.id, status: "ready" },
        after: savedReservation,
        type: "state_transition",
        details: { stateFrom: "ready", stateTo: "fulfilled", stateLabel: "Reservation status", reservationId },
        extraMetadata: { reservation_id: Number(reservationId), copy_barcode: savedReservation.barcode },
      });
    }
    await notificationsService.enqueueNotification(conn, {
      type: "borrowing_created",
      title: "Book borrowed successfully",
      body: `You borrowed "${copy.title}". Please return it on or before ${new Date(dueDate).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: userId,
      createdBy: issuedBy ?? null,
    });
    const [[savedBorrowing]] = await conn.query(
      `SELECT b.id, b.status, b.due_date, bk.title, bc.id AS copy_id, bc.barcode
         FROM borrowings b JOIN books bk ON bk.id = b.book_id
         JOIN book_copies bc ON bc.id = b.copy_id WHERE b.id = ?`,
      [borrowingId],
    );
    const copyDescription = `Borrowed “${savedBorrowing.title}” · ${copyLabel(savedBorrowing)}`;
    await enqueueTransactionalAudit(conn, {
      actorId: issuedBy,
      category: "borrowing",
      route: auditRoute || `/api/borrowing/borrows/${bookIdOrCopyBarcode}`,
      action: "borrowed",
      description: copyDescription,
      before: { status: "available" },
      after: savedBorrowing,
      type: "state_transition",
      details: { stateFrom: "Available", stateTo: "Borrowed", stateLabel: "Copy status", borrowingId },
      extraMetadata: { borrowing_id: borrowingId, copy_barcode: savedBorrowing.barcode, copy_display_description: copyDescription },
    });
    await conn.commit();

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

const returnBook = async (borrowingId, userId, { auditRoute = null, actorId = userId } = {}) => {
  const conn = await repository.getConnection();
  let returnedAt;
  try {
    await conn.beginTransaction();
    const row = await repository.getBorrowingForReturn(borrowingId, conn);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (row.user_id !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (row.status === "returned") throw Object.assign(new Error("Book already returned"), { status: 409 });
    const changed = await repository.markReturned(borrowingId, conn);
    if (changed !== 1) throw Object.assign(new Error("This loan changed while the return was being processed. Reload and try again."), { status: 409 });
    const [[returned]] = await conn.query("SELECT returned_at FROM borrowings WHERE id = ?", [borrowingId]);
    returnedAt = returned.returned_at;
    await fineLedger.assessBorrowing({ ...row, returned_at: returnedAt }, conn);
    const target = await repository.getBorrowingNotificationTarget(borrowingId, conn);
    if (target) await notificationsService.enqueueNotification(conn, {
      type: "borrowing_returned",
      title: "Book return recorded",
      body: `Your return for "${target.title}" has been recorded successfully.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: target.user_id,
      createdBy: userId ?? null,
    });
    const [[savedBorrowing]] = await conn.query(
      `SELECT b.id, b.status, b.due_date, b.returned_at, bk.title, bc.id AS copy_id, bc.barcode
         FROM borrowings b JOIN books bk ON bk.id = b.book_id
         JOIN book_copies bc ON bc.id = b.copy_id WHERE b.id = ?`,
      [borrowingId],
    );
    const copyDescription = `Returned “${savedBorrowing.title}” · ${copyLabel(savedBorrowing)}`;
    await enqueueTransactionalAudit(conn, {
      actorId,
      category: "borrowing",
      route: auditRoute || `/api/borrowing/borrows/${borrowingId}/return`,
      action: "returned",
      description: copyDescription,
      before: row,
      after: savedBorrowing,
      type: "state_transition",
      details: { stateFrom: row.status, stateTo: savedBorrowing.status, stateLabel: "Loan status", borrowingId },
      extraMetadata: { borrowing_id: borrowingId, copy_barcode: savedBorrowing.barcode, copy_display_description: copyDescription },
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return { borrowingId, returnedAt };
};

module.exports = { borrowBook, returnBook };
