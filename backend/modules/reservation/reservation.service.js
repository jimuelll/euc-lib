const repository = require("./reservation.repository");
const notificationsService = require("../notifications/notifications.service");
const { assertEligible } = require("../clearance/clearance.service");
const { syncOverdueBorrowings } = require("../borrowing/overdue.helper");
const catalogSettings = require("../catalog/catalog.settings.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

const syncExpired = async () => {
  return repository.syncExpired();
};

const getActiveReservations = async (userId) => {
  await syncExpired();
  return repository.findActiveReservations(userId);
};

const getReservationHistory = async (userId, options = {}) => {
  await syncExpired();
  return repository.findReservationHistory(userId, options);
};

const searchCatalogue = async (query, options = {}) => {
  const settings = await catalogSettings.getCatalogSettings();
  return repository.searchCatalogue(query, { ...options, showUnheldInOpac: settings.show_unheld_in_opac });
};

const reserveBook = async (userId, bookId, hoursUntilExpiry = 48) => {
  await syncOverdueBorrowings();
  await syncExpired();
  const expiryHours = Number(hoursUntilExpiry);
  if (!Number.isInteger(expiryHours) || expiryHours < 1 || expiryHours > 720) {
    throw Object.assign(new Error("Reservation expiry must be between 1 and 720 hours"), { status: 400 });
  }
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    await assertEligible(userId, conn);

    const book = await repository.findBookForReservation(bookId, conn);
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
    if (book.material_type === "thesis") {
      throw Object.assign(new Error("Theses are reference-only and cannot be reserved"), { status: 409 });
    }
    if (!book.has_active_policy) throw Object.assign(new Error("This book needs an active loan policy before it can be reserved"), { status: 409 });
    if (Number(book.registered_copy_count) < 1) {
      throw Object.assign(new Error("This book has no accessioned copies available for reservation"), { status: 409 });
    }

    const existing = await repository.findActiveReservationByUserBook(userId, bookId, conn);
    if (existing) {
      throw Object.assign(
        new Error("You already have an active reservation for this book"),
        { status: 409 }
      );
    }
    const existingBorrowing = await repository.findActiveBorrowingByUserBook(userId, bookId, conn);
    if (existingBorrowing) throw Object.assign(new Error("Return this book before reserving another copy of the same title"), { status: 409 });
    const openReservations = await repository.getOpenReservationCountForBook(bookId, conn);
    if (openReservations >= Number(book.registered_copy_count)) {
      throw Object.assign(new Error("All accessioned lendable copies are already committed to pending or ready reservations"), { status: 409 });
    }
    const result = await repository.createReservation(userId, bookId, expiryHours, conn);
    const savedReservation = await repository.findReservationForAudit(result.insertId, conn);
    await notificationsService.enqueueNotification(conn, {
      type: "reservation_created",
      title: "Reservation placed",
      body: `Your reservation for ${book.title} has been placed and is pending library processing.`,
      href: "/services/borrowing",
      audienceType: "user",
      audienceUserId: userId,
    });
    await enqueueTransactionalAudit(conn, {
      actorId: userId,
      category: "reservation",
      route: `/api/reservations/${bookId}`,
      action: "created",
      description: `Placed reservation for “${book.title}”`,
      before: null,
      after: savedReservation,
      type: "state_transition",
      details: { stateFrom: "Not reserved", stateTo: "Pending", stateLabel: "Reservation status", reservationId: result.insertId },
      extraMetadata: { reservation_id: Number(result.insertId) },
      isCreation: true,
    });
    await conn.commit();

    return { reservationId: result.insertId, expiresAt: savedReservation.expires_at };
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY" && /uq_reservations_active_user_book/.test(String(err.message))) {
      throw Object.assign(new Error("You already have an active reservation for this book"), { status: 409 });
    }
    throw err;
  } finally {
    conn.release();
  }
};

const cancelReservation = async (reservationId, userId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findReservationForUserCancel(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.user_id !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!["pending", "ready"].includes(row.status)) {
      throw Object.assign(new Error("Reservation cannot be cancelled"), { status: 409 });
    }

    const changed = await repository.cancelReservation(reservationId, conn);
    if (changed !== 1) throw Object.assign(new Error("This reservation changed while it was being cancelled. Reload and try again."), { status: 409 });
    const after = await repository.findReservationForAudit(reservationId, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: userId,
      category: "reservation",
      route: `/api/reservations/${reservationId}/cancel`,
      action: "cancelled",
      description: `Cancelled reservation for “${after.title}”`,
      before: row,
      after,
      type: "state_transition",
      details: { stateFrom: row.status, stateTo: after.status, stateLabel: "Reservation status", reservationId },
      extraMetadata: { reservation_id: Number(reservationId) },
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getAdminReservations = async (options) => {
  await syncExpired();
  return repository.getAdminReservations(options);
};

const markReservationReady = async (reservationId, markedBy = null) => {
  await syncExpired();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    // Copy-count edits and checkout both lock the book row first. Preparing a
    // reservation must join that same lock order so a concurrent reduction
    // cannot retire the last copy while this reservation is being assigned.
    const reservationIdentity = await repository.findReservationBookId(reservationId, conn);
    if (!reservationIdentity) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    const book = await repository.findBookForReservation(reservationIdentity.book_id, conn);
    if (!book) throw Object.assign(new Error("Restore the catalog record before preparing this reservation"), { status: 409 });
    if (!book.has_active_policy) throw Object.assign(new Error("This book needs an active loan policy before a reservation can be prepared"), { status: 409 });

    const row = await repository.findReservationForReady(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (Number(row.book_id) !== Number(reservationIdentity.book_id)) {
      throw Object.assign(new Error("The reservation's catalog record changed while it was being prepared. Reload and try again."), { status: 409 });
    }
    if (row.status !== "pending") {
      throw Object.assign(new Error("Only pending reservations can be marked ready"), { status: 409 });
    }
    if (!row.within_deadline) throw Object.assign(new Error("This reservation has expired. Refresh the reservation list before preparing it."), { status: 409 });

    const copy = await repository.findAvailableCopyForReservation(row.book_id, conn);
    if (!copy) {
      throw Object.assign(new Error("No borrowable copy is available to prepare for pickup"), { status: 409 });
    }

    const changed = await repository.markReady(reservationId, copy.id, 48, conn);
    if (changed !== 1) throw Object.assign(new Error("This reservation changed while it was being prepared. Reload and try again."), { status: 409 });
    await notificationsService.enqueueNotification(conn, {
      type: "reservation_ready",
      title: "Reservation ready for pickup",
      body: `${row.title} is now ready for pickup at the library front desk.`,
      href: "/services/borrowing",
      audienceType: "user",
      audienceUserId: row.user_id,
      createdBy: markedBy,
    });
    const after = await repository.findReservationForAudit(reservationId, conn);
    const copyDescription = `Prepared “${row.title}” · ${copyLabel({ id: copy.id, barcode: after?.barcode })}`;
    await enqueueTransactionalAudit(conn, {
      actorId: markedBy,
      category: "reservation",
      route: `/api/admin/reservations/${reservationId}/ready`,
      action: "marked_ready",
      description: copyDescription,
      before: row,
      after,
      type: "state_transition",
      details: { stateFrom: "pending", stateTo: "ready", stateLabel: "Reservation status", reservationId },
      extraMetadata: { reservation_id: Number(reservationId), copy_barcode: after?.barcode, copy_display_description: copyDescription },
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err?.code === "ER_DUP_ENTRY" && /uq_reservations_ready_copy/.test(String(err.message))) {
      throw Object.assign(new Error("That copy is already prepared for another reservation"), { status: 409 });
    }
    throw err;
  } finally {
    conn.release();
  }
};

const cancelReservationAdmin = async (reservationId, cancelledBy = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findReservationForAdminCancel(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (!["pending", "ready"].includes(row.status)) {
      throw Object.assign(new Error("Reservation cannot be cancelled"), { status: 409 });
    }

    const changed = await repository.cancelReservationAdmin(reservationId, conn);
    if (changed !== 1) throw Object.assign(new Error("This reservation changed while it was being cancelled. Reload and try again."), { status: 409 });
    await notificationsService.enqueueNotification(conn, {
      type: "reservation_cancelled",
      title: "Reservation rejected",
      body: `Your reservation for ${row.title} was rejected by the library staff.`,
      href: "/services/borrowing",
      audienceType: "user",
      audienceUserId: row.user_id,
      createdBy: cancelledBy,
    });
    const after = await repository.findReservationForAudit(reservationId, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: cancelledBy,
      category: "reservation",
      route: `/api/admin/reservations/${reservationId}/cancel`,
      action: "cancelled",
      description: `Cancelled reservation for “${row.title}”`,
      before: row,
      after,
      type: "state_transition",
      details: { stateFrom: row.status, stateTo: after?.status, stateLabel: "Reservation status", reservationId },
      extraMetadata: { reservation_id: Number(reservationId) },
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const restoreReservation = async (reservationId, restoredBy = null) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findArchivedReservation(reservationId, conn);
    if (!row) throw Object.assign(new Error("Archived reservation not found"), { status: 404 });

    await repository.restoreReservation(reservationId, conn);
    const after = await repository.findReservationForAudit(reservationId, conn);
    await enqueueTransactionalAudit(conn, {
      actorId: restoredBy,
      category: "reservation",
      route: `/api/admin/reservations/${reservationId}/restore`,
      action: "restored",
      description: `Restored reservation ${reservationId}`,
      before: { status: "archived" },
      after: { ...(after || {}), status: "active record" },
      type: "state_transition",
      details: { stateFrom: "Archived", stateTo: "Active record", stateLabel: "Record state", reservationId },
      extraMetadata: { reservation_id: Number(reservationId) },
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  syncExpired,
  getActiveReservations,
  getReservationHistory,
  searchCatalogue,
  reserveBook,
  cancelReservation,
  getAdminReservations,
  markReservationReady,
  cancelReservationAdmin,
  restoreReservation,
};
