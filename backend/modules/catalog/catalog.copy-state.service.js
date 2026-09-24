const db = require("../../db");
const repository = require("./catalog.repository");
const transactionalAudit = require("../analytics/transactional-audit");
const { copyLabel } = require("../analytics/audit.copy-label");

async function withLockedCopy(copyId, work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[identity]] = await conn.query("SELECT book_id FROM book_copies WHERE id = ? AND deleted_at IS NULL", [copyId]);
    if (!identity) throw Object.assign(new Error("Copy not found"), { status: 404 });
    const [[book]] = await conn.query("SELECT id, title, deleted_at FROM books WHERE id = ? FOR UPDATE", [identity.book_id]);
    if (!book) throw Object.assign(new Error("Catalog record not found"), { status: 404 });
    const copy = await repository.findCopyStateForUpdate(copyId, conn);
    if (!copy) throw Object.assign(new Error("Copy not found"), { status: 404 });
    if (Number(copy.book_id) !== Number(identity.book_id)) {
      throw Object.assign(new Error("The copy was reassigned while this action was starting. Reload and try again."), { status: 409 });
    }
    const result = await work(conn, copy, book);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

async function retireCopy(copyId, userId) {
  if (!Number.isSafeInteger(copyId) || copyId < 1) throw Object.assign(new Error("Invalid copy ID"), { status: 400 });
  return withLockedCopy(copyId, async (conn, copy, book) => {
    if (!copy.is_active) throw Object.assign(new Error("This copy is already retired"), { status: 409 });
    if (copy.has_active_loan) throw Object.assign(new Error("Return this copy before retiring it"), { status: 409 });
    if (copy.has_prepared_reservation) throw Object.assign(new Error("Resolve its prepared reservation before retiring this copy"), { status: 409 });
    const pending = await repository.getPendingReservationCount(copy.book_id, conn);
    const remainingEligible = await repository.getAvailableEligibleCopyCount(copy.book_id, conn, copy.id);
    if (remainingEligible < pending) {
      throw Object.assign(new Error(`Cannot retire this copy: ${pending} pending reservation${pending === 1 ? " needs" : "s need"} an available accessioned copy to prepare, but only ${remainingEligible} would remain. Resolve or cancel pending reservations first.`), { status: 409, pendingReservations: pending, eligibleCopiesAfterRetirement: remainingEligible });
    }
    const changed = await repository.setCopyActive(copy.id, false, conn);
    if (changed !== 1) throw Object.assign(new Error("The copy changed while it was being retired. Reload and try again."), { status: 409 });
    const activeCount = await repository.getActiveCopyCount(copy.book_id, conn);
    await repository.updateBookCopyCount(copy.book_id, activeCount, conn);
    const route = `/api/admin/copies/${copy.id}/retire`;
    const description = `Retired ${copyLabel(copy)} of “${book.title}”`;
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: userId, route, action: "updated",
      description,
      before: { ...copy, is_active: 1 }, after: { ...copy, is_active: 0 },
      type: "state_transition",
      details: { stateFrom: "Active", stateTo: "Retired", stateLabel: "Copy state" },
      extraMetadata: { copy_barcode: copy.barcode, copy_display_description: description },
    });
    return { auditEnqueued: true, copies: activeCount };
  });
}

async function restoreCopy(copyId, userId) {
  if (!Number.isSafeInteger(copyId) || copyId < 1) throw Object.assign(new Error("Invalid copy ID"), { status: 400 });
  return withLockedCopy(copyId, async (conn, copy, book) => {
    if (book.deleted_at) throw Object.assign(new Error("Restore the archived book before restoring one of its copies"), { status: 409 });
    if (copy.is_active) throw Object.assign(new Error("This copy is already active"), { status: 409 });
    if (copy.has_active_loan) throw Object.assign(new Error("Resolve the active loan before restoring this copy"), { status: 409 });
    if (copy.has_prepared_reservation) throw Object.assign(new Error("Resolve its prepared reservation before restoring this copy"), { status: 409 });
    const changed = await repository.setCopyActive(copy.id, true, conn);
    if (changed !== 1) throw Object.assign(new Error("The copy changed while it was being restored. Reload and try again."), { status: 409 });
    const activeCount = await repository.getActiveCopyCount(copy.book_id, conn);
    await repository.updateBookCopyCount(copy.book_id, activeCount, conn);
    const route = `/api/admin/copies/${copy.id}/restore`;
    const description = `Restored ${copyLabel(copy)} of “${book.title}”`;
    await transactionalAudit.enqueueTransactionalAudit(conn, {
      actorId: userId, route, action: "updated",
      description,
      before: { ...copy, is_active: 0 }, after: { ...copy, is_active: 1 },
      type: "state_transition",
      details: { stateFrom: "Retired", stateTo: "Active", stateLabel: "Copy state" },
      extraMetadata: { copy_barcode: copy.barcode, copy_display_description: description },
    });
    return {
      auditEnqueued: true,
      copies: activeCount,
      lendingEligible: Boolean(
        copy.accession_number
        && !copy.accession_voided
        && ["good", "damaged"].includes(copy.condition)
        && copy.material_type === "book"
        && copy.has_active_policy
        && !book.deleted_at,
      ),
    };
  });
}

module.exports = { retireCopy, restoreCopy };
