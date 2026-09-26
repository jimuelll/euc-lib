import type { PoolConnection } from "mysql2/promise";
import overdue = require("./overdue.helper");
import fineLedger = require("./fine-ledger.service");

const repository = require("./borrowing.repository");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit") as {
  enqueueTransactionalAudit: (conn: PoolConnection, options: Record<string, unknown>) => Promise<void>;
};
const { copyLabel } = require("../analytics/audit.copy-label") as { copyLabel: (row: Record<string, unknown>) => string };

const adminDeleteBorrowing = async (borrowingId: number, deletedBy: number | null | undefined): Promise<void> => {
  const owner = await repository.getAdminBorrowing(borrowingId);
  if (!owner) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
  const conn: PoolConnection = await repository.getConnection();
  try {
    await conn.beginTransaction();
    if (!await repository.lockBorrowingOwner(owner.user_id, conn)) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    const row = await repository.getAdminBorrowingForUpdate(borrowingId, conn);
    if (!row) throw Object.assign(new Error("Borrowing record not found"), { status: 404 });
    if (["borrowed", "overdue"].includes(row.status)) {
      throw Object.assign(new Error("Cannot archive an active borrowing — return the book first"), { status: 409 });
    }
    await fineLedger.assertNoOutstandingFines([borrowingId], conn, "This borrowing cannot be archived");
    if (await repository.archiveBorrowing(borrowingId, deletedBy, conn) !== 1) {
      throw Object.assign(new Error("Borrowing record changed while it was being archived"), { status: 409 });
    }
    const after = await repository.getAdminBorrowingAuditSnapshot(borrowingId, conn);
    const description = `Archived borrowing for “${row.title}” · ${copyLabel(row)}`;
    await enqueueTransactionalAudit(conn, {
      actorId: deletedBy,
      category: "borrowing",
      route: `/api/borrowing/admin/borrows/${borrowingId}`,
      action: "archived",
      description,
      before: row,
      after,
      type: "state_transition",
      details: { stateFrom: "Active record", stateTo: "Archived", stateLabel: "Borrowing record" },
      extraMetadata: { borrowing_id: Number(borrowingId), copy_barcode: row.barcode },
    });
    await conn.commit();
  } catch (error: unknown) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const adminRestoreBorrowing = async (borrowingId: number, restoredBy: number | null = null): Promise<void> => {
  const conn: PoolConnection = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const before = await repository.getArchivedBorrowing(borrowingId, conn);
    if (!before) throw Object.assign(new Error("Archived borrowing record not found"), { status: 404 });
    if (!await repository.lockBorrowingOwner(before.user_id, conn)) throw Object.assign(new Error("Archived borrowing record not found"), { status: 404 });
    if (await repository.restoreBorrowing(borrowingId, conn) !== 1) {
      throw Object.assign(new Error("Borrowing record changed while it was being restored"), { status: 409 });
    }
    const after = await repository.getAdminBorrowingAuditSnapshot(borrowingId, conn);
    const description = `Restored borrowing for “${before.title}” · ${copyLabel(before)}`;
    await enqueueTransactionalAudit(conn, {
      actorId: restoredBy,
      category: "borrowing",
      route: `/api/borrowing/admin/borrows/${borrowingId}/restore`,
      action: "restored",
      description,
      before,
      after,
      type: "state_transition",
      details: { stateFrom: "Archived", stateTo: "Active record", stateLabel: "Borrowing record" },
      extraMetadata: { borrowing_id: Number(borrowingId), copy_barcode: before.barcode },
    });
    await conn.commit();
  } catch (error: unknown) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const adminGetBorrowings = async (options: Record<string, unknown>) => {
  await overdue.syncOverdueBorrowings();
  const result = await repository.getAdminBorrowings(options);
  return {
    rows: await overdue.mapBorrowingsWithFineDetails(result.rows),
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

export = { adminDeleteBorrowing, adminRestoreBorrowing, adminGetBorrowings };
