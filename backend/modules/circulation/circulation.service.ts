import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import repository = require("./circulation.repository");
import type { ProcessRenewInput } from "./circulation.types";

const { syncOverdueBorrowings } = require("../borrowing/overdue.helper") as { syncOverdueBorrowings: () => Promise<void> };
const { calculateLoanDueDate } = require("../borrowing/loan-duration") as {
  calculateLoanDueDate: (from: Date, duration: { minutes: number; unit: string }, connection: PoolConnection) => Promise<Date | string>;
};
const fineLedger = require("../borrowing/fine-ledger.service");
const clearance = require("../clearance/clearance.service") as { assertEligible: (userId: number, conn?: PoolConnection) => Promise<unknown> };

const MAX_RENEWALS = 2;
import { formatLibraryDeadline } from "../time/library-time";
const notificationsService = require("../notifications/notifications.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit") as {
  enqueueTransactionalAudit: (conn: PoolConnection, entry: Record<string, unknown>) => Promise<void>;
};

interface ServiceError extends Error {
  status?: number;
  materialType?: string;
}

const createServiceError = (message: string, status: number, extra: Pick<ServiceError, "materialType"> = {}): ServiceError => Object.assign(new Error(message), { status, ...extra });

const processRenew = async ({ borrowingId, renewedBy = null }: ProcessRenewInput) => {
  await syncOverdueBorrowings();
  const connection = await repository.getConnection();
  let dueDate: Date | string;
  try {
    await connection.beginTransaction();
    const row = await repository.getBorrowingForRenewal(borrowingId, connection);
    if (!row) throw createServiceError("Borrowing record not found", 404);
    if (row.status === "returned") throw createServiceError("Cannot renew a returned book", 409);
    if (!row.has_active_policy) throw createServiceError("This book needs an active loan policy before it can be renewed", 409);
    if (Number(row.renewal_count) >= MAX_RENEWALS) throw createServiceError(`This loan has already been renewed ${MAX_RENEWALS} times, the maximum allowed. The book must be returned.`, 409);
    if (await repository.countOtherOpenReservations(row.book_id, row.user_id, connection) > 0) throw createServiceError("Another patron has reserved this title, so it cannot be renewed. The book must be returned.", 409);
    await clearance.assertEligible(row.user_id, connection);
    if (!Number.isInteger(Number(row.loan_duration_minutes)) || !["day", "hour"].includes(row.loan_duration_unit || "")) {
      throw createServiceError("This loan has no saved renewal duration. Ask an administrator to review the borrowing record.", 409);
    }
    dueDate = await calculateLoanDueDate(new Date(), {
      minutes: Number(row.loan_duration_minutes),
      unit: row.loan_duration_unit || "",
    }, connection);
    await fineLedger.assessBorrowing(row, connection);
    await fineLedger.beginRenewalCycle(borrowingId, connection);
    const changed = await repository.renewBorrowing(borrowingId, dueDate, connection);
    if (changed !== 1) throw createServiceError("This loan changed while renewal was being processed. Reload and try again.", 409);
    await notificationsService.enqueueNotification(connection, {
      type: "borrowing_renewed", sourceType: "borrowing", sourceId: borrowingId, emailDueDate: new Date(dueDate).toISOString(), title: "Book renewal recorded",
      body: `Your borrowing for "${row.title}" has been renewed. New due date: ${formatLibraryDeadline(dueDate)}.`,
      href: "/my-library", audienceType: "user", audienceUserId: row.user_id, createdBy: renewedBy,
    });
    const [savedRows] = await connection.query<Array<RowDataPacket & { id: number; status: string; due_date: Date | string }>>(
      "SELECT id, status, due_date FROM borrowings WHERE id = ?",
      [borrowingId],
    );
    const [savedBorrowing] = savedRows;
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

export = { processRenew };
