const repository = require("./clearance.repository");
const { syncOverdueBorrowings, listUnsettledBorrowings } = require("../borrowing/overdue.helper");
const notificationsService = require("../notifications/notifications.service");

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const buildStatus = async (userId, conn) => {
  const overdueRows = await repository.findOverdueBorrowings(userId, conn);
  const fines = await listUnsettledBorrowings({ userId }, conn);
  const reasons = [];
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

const getClearanceProfile = async (studentEmployeeId) => {
  await syncOverdueBorrowings();
  const user = await repository.findUserByStudentEmployeeId(studentEmployeeId);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  const clearance = await buildStatus(user.id);
  const reservations = await repository.findUserReservations(user.id);
  const transactions = await repository.findUserTransactions(user.id);
  return { user, ...clearance, reservations, transactions };
};

const getClearanceQueue = async ({ page, limit } = {}) => {
  await syncOverdueBorrowings();
  const overdueRows = await repository.findQueueOverdueBorrowings();
  const fines = await listUnsettledBorrowings();
  const queue = new Map();

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
      name: fine.user_name,
      studentEmployeeId: fine.student_employee_id,
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

const assertEligible = async (userId, conn) => {
  const user = await repository.findActiveUser(userId, conn);
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (!user.is_active) throw Object.assign(new Error("User account is inactive"), { status: 403 });
  const profile = await buildStatus(userId, conn);
  if (profile.status === "blocked") {
    throw Object.assign(new Error(`Clearance required: ${profile.reasons.join("; ")}`), { status: 409, clearance: profile });
  }
  return profile;
};

const recordFullPayment = async ({ studentEmployeeId, createdBy }) => {
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const user = await repository.findUserForPayment(studentEmployeeId, conn);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const fines = await listUnsettledBorrowings({ userId: user.id }, conn);
    const amount = fines.summary.total_unsettled_amount;
    if (amount <= 0) throw Object.assign(new Error("This user has no outstanding fines"), { status: 409 });
    const transaction = await repository.createTransaction({
      userId: user.id,
      type: "payment",
      amount,
      method: "cash",
      createdBy,
      allocations: fines.rows.map((row) => ({ borrowingId: row.id, amount: row.unsettled_amount })),
    }, conn);
    await conn.commit();
    const clearance = await getClearanceProfile(user.student_employee_id);
    await notificationsService.createNotification({
      type: "payment_settled",
      title: "Payment received",
      body: `A cash payment of PHP ${amount.toFixed(2)} was recorded for your library fines.`,
      href: "/my-library",
      audienceType: "user",
      audienceUserId: user.id,
      createdBy,
    });
    return { message: "Full payment recorded", receiptNumber: transaction.receiptNumber, transactionId: transaction.id, amount, clearance };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const adjustFine = async ({ borrowingId, amount, reason, createdBy }) => {
  const reduction = roundCurrency(amount);
  if (reduction <= 0 || !String(reason || "").trim()) throw Object.assign(new Error("A positive reduction and written reason are required"), { status: 400 });
  await syncOverdueBorrowings();
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const borrowing = await repository.findBorrowingForAdjustment(borrowingId, conn);
    if (!borrowing) throw Object.assign(new Error("Borrowing not found"), { status: 404 });
    const fines = await listUnsettledBorrowings({ userId: borrowing.user_id }, conn);
    const row = fines.rows.find((item) => Number(item.id) === Number(borrowingId));
    if (!row || reduction > Number(row.unsettled_amount)) throw Object.assign(new Error("Reduction cannot exceed this borrowing's outstanding fine"), { status: 409 });
    const transaction = await repository.createTransaction({
      userId: borrowing.user_id,
      type: "adjustment",
      amount: reduction,
      reason: String(reason).trim(),
      createdBy,
      allocations: [{ borrowingId, amount: reduction }],
    }, conn);
    await conn.commit();
    return { message: "Fine adjustment recorded", transactionId: transaction.id };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const reverseTransaction = async ({ transactionId, reason, createdBy }) => {
  if (!String(reason || "").trim()) throw Object.assign(new Error("A written correction reason is required"), { status: 400 });
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const transaction = await repository.findTransactionForReverse(transactionId, conn);
    if (!transaction) throw Object.assign(new Error("Transaction not found"), { status: 404 });
    if (transaction.transaction_type === "reversal") throw Object.assign(new Error("A reversal cannot be reversed"), { status: 409 });
    if (await repository.findExistingReversal(transactionId, conn)) throw Object.assign(new Error("This transaction has already been corrected"), { status: 409 });
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
    await conn.commit();
    return { message: "Transaction corrected", transactionId: reversal.id };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const getReceipt = async (receiptNumber) => {
  const transaction = await repository.findReceipt(receiptNumber);
  if (!transaction) throw Object.assign(new Error("Receipt not found"), { status: 404 });
  const items = await repository.findReceiptItems(transaction.id);
  return { transaction, items };
};

module.exports = { getClearanceProfile, getClearanceQueue, assertEligible, recordFullPayment, adjustFine, reverseTransaction, getReceipt };
