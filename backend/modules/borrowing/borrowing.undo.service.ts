import type { PoolConnection } from "mysql2/promise";
import tokens = require("./borrowing.undo-token");
import notifications = require("../notifications/notifications.service");
const repository = require("./borrowing.repository");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });

async function undoDeskTransaction(token: string, actorId: number) {
  const intent = tokens.verifyDeskUndo(token, actorId);
  const owner = await repository.getAdminBorrowing(intent.borrowingId);
  if (!owner?.copy_id) throw conflict("This record can no longer be undone.");
  const conn: PoolConnection = await repository.getConnection();
  try {
    await conn.beginTransaction();
    await repository.lockBorrowingOwner(owner.user_id, conn);
    await repository.lockDeskUndoCopy(owner.book_id, owner.copy_id, conn);
    const before = await repository.getAdminBorrowingForUpdate(intent.borrowingId, conn);
    // Recheck expiry after waiting for locks; a signed token never bypasses current state.
    tokens.verifyDeskUndo(token, actorId);
    if (!before || String(before.notes || "").includes(`Desk undo ${intent.jti}`) || before.deleted_at || Number(before.user_id) !== Number(owner.user_id) || Number(before.copy_id) !== Number(owner.copy_id)) throw conflict("This record changed. Undo is unavailable.");
    if (!await repository.isDeskUndoFineFree(intent.borrowingId, conn)) throw conflict("Fine-related records cannot be undone at the desk.");
    if (intent.kind === "borrow") {
      if (before.status !== "borrowed" || Number(before.issued_by) !== actorId || Date.now() - new Date(before.borrowed_at).getTime() > 60_000) throw conflict("This loan can no longer be undone.");
    } else {
      if (before.status !== "returned" || !intent.returnedAt || new Date(before.returned_at).toISOString() !== intent.returnedAt || new Date(before.due_date).getTime() <= Date.now()) throw conflict("This return can no longer be undone.");
      if (await repository.findActiveBorrowingByCopy(before.copy_id, conn) || await repository.findActiveBorrowingByUserBook(before.user_id, before.book_id, conn) || await repository.findReadyHoldByCopy(before.copy_id, conn) || await repository.countPendingReservationsForBook(before.book_id, conn)) throw conflict("The copy or patron has new circulation activity. Undo is unavailable.");
    }
    if (await repository.reverseDeskTransaction(intent.borrowingId, intent.kind, actorId, intent.jti!, conn) !== 1) throw conflict("The record changed while undoing it.");
    const after = await repository.getAdminBorrowingAuditSnapshot(intent.borrowingId, conn);
    await enqueueTransactionalAudit(conn, { actorId, category: "borrowing", route: "/api/borrowing/scan/undo", action: "reversed", description: `Desk ${intent.kind} reversed for "${before.title}"`, before, after, type: "state_transition", details: { stateFrom: before.status, stateTo: after.status, stateLabel: "Loan record" }, extraMetadata: { borrowing_id: intent.borrowingId, reversal_kind: intent.kind } });
    await notifications.enqueueNotification(conn, { type: "borrowing_returned", title: "Desk transaction corrected", body: intent.kind === "borrow" ? `The recent loan for "${before.title}" was reversed by library staff.` : `The recent return for "${before.title}" was reversed. This copy remains on loan.`, href: "/my-library", audienceType: "user", audienceUserId: before.user_id, createdBy: actorId });
    await conn.commit();
    return { message: "Transaction undone", borrowingId: intent.borrowingId };
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}
export = { undoDeskTransaction };
