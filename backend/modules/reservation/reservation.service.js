const repository = require("./reservation.repository");
const notificationsService = require("../notifications/notifications.service");
const { assertEligible } = require("../clearance/clearance.service");
const { syncOverdueBorrowings } = require("../borrowing/overdue.helper");

const syncExpired = async () => {
  const expiredRows = await repository.syncExpired();
  for (const row of expiredRows) {
    await notificationsService.createNotification({
      type: "reservation_expired",
      title: "Reservation expired",
      body: `Your reservation for ${row.title} expired before pickup.`,
      href: "/services/borrowing",
      audienceType: "user",
      audienceUserId: row.user_id,
    });
  }
};

const getActiveReservations = async (userId) => {
  await syncExpired();
  return repository.findActiveReservations(userId);
};

const getReservationHistory = async (userId, options = {}) =>
  repository.findReservationHistory(userId, options);

const searchCatalogue = async (query, options = {}) =>
  repository.searchCatalogue(query, options);

const reserveBook = async (userId, bookId, hoursUntilExpiry = 48) => {
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    await assertEligible(userId, conn);

    const book = await repository.findBookForReservation(bookId, conn);
    if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });
    if (book.material_type === "thesis") {
      throw Object.assign(new Error("Theses are reference-only and cannot be reserved"), { status: 409 });
    }

    const existing = await repository.findActiveReservationByUserBook(userId, bookId, conn);
    if (existing) {
      throw Object.assign(
        new Error("You already have an active reservation for this book"),
        { status: 409 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursUntilExpiry);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");
    const result = await repository.createReservation(userId, bookId, expiresAtStr, conn);

    await conn.commit();

    const target = await repository.getReservationNotificationTarget(result.insertId);
    if (target) {
      await notificationsService.createNotification({
        type: "reservation_created",
        title: "Reservation placed",
        body: `Your reservation for ${target.title} has been placed and is pending library processing.`,
        href: "/services/borrowing",
        audienceType: "user",
        audienceUserId: target.user_id,
      });
    }

    return { reservationId: result.insertId, expiresAt: expiresAtStr };
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

    await repository.cancelReservation(reservationId, conn);
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

const markReservationReady = async (reservationId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findReservationForReady(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.status !== "pending") {
      throw Object.assign(new Error("Only pending reservations can be marked ready"), { status: 409 });
    }

    const copy = await repository.findAvailableCopyForReservation(row.book_id, conn);
    if (!copy) {
      throw Object.assign(new Error("No borrowable copy is available to prepare for pickup"), { status: 409 });
    }

    await repository.markReady(reservationId, copy.id, conn);
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

const fulfillReservation = async (reservationId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findReservationForFulfill(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (row.status !== "ready") {
      throw Object.assign(new Error("Only ready reservations can be fulfilled"), { status: 409 });
    }

    await repository.fulfillReservation(reservationId, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const cancelReservationAdmin = async (reservationId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findReservationForAdminCancel(reservationId, conn);
    if (!row) throw Object.assign(new Error("Reservation not found"), { status: 404 });
    if (!["pending", "ready"].includes(row.status)) {
      throw Object.assign(new Error("Reservation cannot be cancelled"), { status: 409 });
    }

    await repository.cancelReservationAdmin(reservationId, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const restoreReservation = async (reservationId) => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const row = await repository.findArchivedReservation(reservationId, conn);
    if (!row) throw Object.assign(new Error("Archived reservation not found"), { status: 404 });

    await repository.restoreReservation(reservationId, conn);
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
  fulfillReservation,
  cancelReservationAdmin,
  restoreReservation,
};
