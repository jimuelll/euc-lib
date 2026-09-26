import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import repository = require("./clearance.repository");
import type {
  ClearanceQueueEntry,
  ClearanceQueuePage,
  ClearanceStatus,
  ClearanceTransactionType,
  FineList,
} from "./clearance.types";

const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper") as {
  syncOverdueBorrowings: () => Promise<void>;
  listUnsettledBorrowings: (options?: { userId?: number }, conn?: PoolConnection) => Promise<FineList>;
};
const notificationsService = require("../notifications/notifications.service");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit") as {
  enqueueTransactionalAudit: (conn: PoolConnection, entry: Record<string, unknown>) => Promise<void>;
};

interface ServiceError extends Error {
  status?: number;
  clearance?: ClearanceStatus;
}

interface QueueOptions {
  page?: number;
  limit?: number;
}

interface FullPaymentInput {
  studentEmployeeId: string;
  createdBy: number;
}

interface FineAdjustmentInput {
  borrowingId: number;
  amount: unknown;
  reason: unknown;
  createdBy: number;
}

interface TransactionReversalInput {
  transactionId: number;
  reason: unknown;
  createdBy: number;
}

const createServiceError = (message: string, status: number, extra: Partial<ServiceError> = {}): ServiceError => Object.assign(new Error(message), { status, ...extra });
const roundCurrency = (value: unknown): number => Number((Number(value) || 0).toFixed(2));

const buildStatus = async (userId: number, conn?: PoolConnection): Promise<ClearanceStatus> => {
  const overdueRows = await repository.findOverdueBorrowings(userId, conn);
  const fines = await listUnsettledBorrowings({ userId }, conn);
  const reasons: string[] = [];
  if (overdueRows.length) reasons.push(`${overdueRows.length} overdue item${overdueRows.length === 1 ? "" : "s"} must be returned`);
  if (fines.summary.total_unsettled_amount > 0) reasons.push(`PHP ${fines.summary.total_unsettled_amount.toFixed(2)} outstanding fine${fines.summary.total_unsettled_amount === 1 ? "" : "s"}`);
  return {
    status: reasons.length ? "blocked" : "eligible",
    reasons,
    overdueItems: overdueRows,
    fineRows: fines.rows,
    outstandingAmount: fines.summary.total_unsettled_amount,
  };
};

const getClearanceProfile = async (studentEmployeeId: string) => {
  await syncOverdueBorrowings();
  const user = await repository.findUserByStudentEmployeeId(studentEmployeeId);
  if (!user) throw createServiceError("User not found", 404);
  const clearance = await buildStatus(user.id);
  const reservations = await repository.findUserReservations(user.id);
  const transactions = await repository.findUserTransactions(user.id);
  return { user, ...clearance, reservations, transactions };
};

const getClearanceQueue = async ({ page, limit }: QueueOptions = {}): Promise<ClearanceQueueEntry[] | ClearanceQueuePage> => {
  await syncOverdueBorrowings();
  const overdueRows = await repository.findQueueOverdueBorrowings();
  const fines = await listUnsettledBorrowings();
  const queue = new Map<number, ClearanceQueueEntry>();

  for (const row of overdueRows) {
    queue.set(row.user_id, {
      userId: row.user_id,
      name: row.name,
      studentEmployeeId: row.student_employee_id,
      overdueCount: Number(row.overdue_count),
      oldestDueDate: row.oldest_due_date,
      overdueTitles: row.overdue_titles ? row.overdue_titles.split(" | ") : [],
      outstandingAmount: 0,
      fineRecords: 0,
    });
  }
  for (const fine of fines.rows) {
    const existing = queue.get(fine.user_id) || {
      userId: fine.user_id,
      name: String(fine.user_name || ""),
      studentEmployeeId: String(fine.student_employee_id || ""),
      overdueCount: 0,
      oldestDueDate: null,
      overdueTitles: [],
      outstandingAmount: 0,
      fineRecords: 0,
    };
    existing.outstandingAmount = roundCurrency(existing.outstandingAmount + Number(fine.unsettled_amount));
    existing.fineRecords += 1;
    queue.set(fine.user_id, existing);
  }

  const rows = Array.from(queue.values()).sort((left, right) => {
    if (right.overdueCount !== left.overdueCount) return right.overdueCount - left.overdueCount;
    if (right.outstandingAmount !== left.outstandingAmount) return right.outstandingAmount - left.outstandingAmount;
    return String(left.name).localeCompare(String(right.name));
  });

  if (!Number.isFinite(Number(page))) return rows;
  const safePage = Math.max(1, Number(page));
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const total = rows.length;
  return {
    rows: rows.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
};

const assertEligible = async (userId: number, conn?: PoolConnection): Promise<ClearanceStatus> => {
  const user = await repository.findActiveUser(userId, conn as PoolConnection);
  if (!user) throw createServiceError("User not found", 404);
  if (!user.is_active) throw createServiceError("User account is inactive", 403);
  const profile = await buildStatus(userId, conn);
  if (profile.status === "blocked") throw createServiceError(`Clearance required: ${profile.reasons.join("; ")}`, 409, { clearance: profile });
  return profile;
};

const recordFullPayment = async ({ studentEmployeeId, createdBy }: FullPaymentInput) => {
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const user = await repository.findUserForPayment(studentEmployeeId, conn);
    if (!user) throw createServiceError("User not found", 404);
    const fines = await listUnsettledBorrowings({ userId: user.id }, conn);
    const amount = fines.summary.total_unsettled_amount;
    if (amount <= 0) throw createServiceError("This user has no outstanding fines", 409);
    const transaction = await repository.createTransaction({
      userId: user.id,
      type: "payment",
      amount,
      method: "cash",
      createdBy,
      allocations: fines.rows.map((row) => ({ borrowingId: row.id, amount: row.unsettled_amount })),
    }, conn);
    const [savedRows] = await conn.query<Array<RowDataPacket & { id: number; transaction_type: string; amount: number | string; receipt_number: string | null }>>(
      "SELECT id, transaction_type, amount, receipt_number FROM clearance_transactions WHERE id = ?",
      [transaction.id],
    );
    const [savedTransaction] = savedRows;
    await enqueueTransactionalAudit(conn, {
      actorId: createdBy,
      category: "clearance",
      route: "/api/admin/clearance/payment",
      action: "payment_recorded",
      description: `Recorded fine payment ${savedTransaction.receipt_number}`,
      before: null,
      after: savedTransaction,
      details: { transactionId: savedTransaction.id, stateFrom: "Not recorded", stateTo: "Recorded", stateLabel: "Payment" },
      type: "state_transition",
    });
    await notificationsService.enqueueNotification(conn, {
      type: "payment_settled",
      title: "Payment received",
      body: `A cash payment of PHP ${amount.toFixed(2)} was recorded for your library fines.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: user.id,
      createdBy,
    });
    const clearance = await buildStatus(user.id, conn);
    await conn.commit();
    return { message: "Full payment recorded", receiptNumber: transaction.receiptNumber, transactionId: transaction.id, amount, clearance: { user, ...clearance } };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const adjustFine = async ({ borrowingId, amount, reason, createdBy }: FineAdjustmentInput) => {
  const reduction = roundCurrency(amount);
  if (reduction <= 0 || !String(reason || "").trim()) throw createServiceError("A positive reduction and written reason are required", 400);
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const borrowing = await repository.findBorrowingForAdjustment(borrowingId, conn);
    if (!borrowing) throw createServiceError("Borrowing not found", 404);
    const fines = await listUnsettledBorrowings({ userId: borrowing.user_id }, conn);
    const row = fines.rows.find((item) => Number(item.id) === Number(borrowingId));
    if (!row || reduction > Number(row.unsettled_amount)) throw createServiceError("Reduction cannot exceed this borrowing's outstanding fine", 409);
    const transaction = await repository.createTransaction({
      userId: borrowing.user_id,
      type: "adjustment",
      amount: reduction,
      reason: String(reason).trim(),
      createdBy,
      allocations: [{ borrowingId, amount: reduction }],
    }, conn);
    const [savedRows] = await conn.query<Array<RowDataPacket & { id: number; transaction_type: string; amount: number | string; receipt_number: string | null }>>(
      "SELECT id, transaction_type, amount, receipt_number FROM clearance_transactions WHERE id = ?",
      [transaction.id],
    );
    const [savedTransaction] = savedRows;
    await enqueueTransactionalAudit(conn, {
      actorId: createdBy,
      category: "clearance",
      route: `/api/admin/clearance/borrowings/${borrowingId}/adjust`,
      action: "adjusted",
      description: `Adjusted fine for borrowing ${borrowingId}`,
      before: null,
      after: savedTransaction,
      details: { transactionId: savedTransaction.id, borrowingId, stateFrom: "Not recorded", stateTo: "Adjusted", stateLabel: "Fine adjustment" },
      type: "state_transition",
    });
    await conn.commit();
    return { message: "Fine adjustment recorded", transactionId: transaction.id, amount: reduction };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const reverseTransaction = async ({ transactionId, reason, createdBy }: TransactionReversalInput) => {
  if (!String(reason || "").trim()) throw createServiceError("A written correction reason is required", 400);
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const transaction = await repository.findTransactionForReverse(transactionId, conn);
    if (!transaction) throw createServiceError("Transaction not found", 404);
    if (transaction.transaction_type === "reversal") throw createServiceError("A reversal cannot be reversed", 409);
    if (await repository.findExistingReversal(transactionId, conn)) throw createServiceError("This transaction has already been corrected", 409);
    const patron = await repository.lockUserForFineChange(transaction.user_id, conn);
    if (!patron || !patron.is_active || patron.deleted_at) throw createServiceError("Restore this patron account before changing its fine ledger", 409);
    const items = await repository.findTransactionItems(transactionId, conn);
    const reversal = await repository.createTransaction({
      userId: transaction.user_id,
      type: "reversal",
      amount: -Number(transaction.amount),
      reason: String(reason).trim(),
      createdBy,
      reversesTransactionId: transactionId,
      allocations: items.map((item) => ({ borrowingId: item.borrowing_id, amount: -Number(item.amount) })),
    }, conn);
    const [savedRows] = await conn.query<Array<RowDataPacket & { id: number; transaction_type: string; amount: number | string; receipt_number: string | null }>>(
      "SELECT id, transaction_type, amount, receipt_number FROM clearance_transactions WHERE id = ?",
      [reversal.id],
    );
    const [savedTransaction] = savedRows;
    await enqueueTransactionalAudit(conn, {
      actorId: createdBy,
      category: "clearance",
      route: `/api/admin/clearance/transactions/${transactionId}/reverse`,
      action: "reversed",
      description: `Corrected clearance transaction ${transactionId}`,
      before: null,
      after: savedTransaction,
      details: { transactionId: savedTransaction.id, stateFrom: "Not recorded", stateTo: "Reversed", stateLabel: "Transaction correction" },
      type: "state_transition",
    });
    await conn.commit();
    return { message: "Transaction corrected", transactionId: reversal.id, amount: -Number(transaction.amount) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const getReceipt = async (receiptNumber: string) => {
  const transaction = await repository.findReceipt(receiptNumber);
  if (!transaction) throw createServiceError("Receipt not found", 404);
  const items = await repository.findReceiptItems(transaction.id);
  return { transaction, items };
};

export = { getClearanceProfile, getClearanceQueue, assertEligible, recordFullPayment, adjustFine, reverseTransaction, getReceipt };
