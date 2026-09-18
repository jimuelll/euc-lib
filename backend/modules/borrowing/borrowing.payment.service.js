const repository = require("./borrowing.repository");
const { listUnsettledBorrowings, mapBorrowingsWithFineDetails, syncOverdueBorrowings } = require("./overdue.helper");
const notificationsService = require("../notifications/notifications.service");
const { roundCurrency } = require("./borrowing.helpers");

const getAdminPaymentOverview = async ({ page = null, limit = 20 } = {}) => {
  await syncOverdueBorrowings();
  const paymentOverview = await listUnsettledBorrowings({ page, limit });
  return { rows: paymentOverview.rows, summary: paymentOverview.summary, pagination: paymentOverview.pagination };
};

const getUserPaymentOverview = async (studentEmployeeId) => {
  const user = await repository.findUserForPaymentOverview(studentEmployeeId.trim());
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  const paymentOverview = await listUnsettledBorrowings({ userId: user.id });
  return { user, rows: paymentOverview.rows, summary: paymentOverview.summary };
};

const settleUserPayments = async ({ studentEmployeeId, amount, settledBy }) => {
  const trimmedId = String(studentEmployeeId ?? "").trim();
  const numericAmount = roundCurrency(amount);
  if (!trimmedId) throw Object.assign(new Error("Student or employee ID is required"), { status: 400 });
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw Object.assign(new Error("Payment amount must be greater than zero"), { status: 400 });
  await syncOverdueBorrowings();

  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();
    const user = await repository.findUserForPayment(trimmedId, conn);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    const rows = await repository.findPaymentRows(user.id, conn);
    const mappedRows = await mapBorrowingsWithFineDetails(rows, conn);
    const unsettledRows = mappedRows.filter((row) => Number(row.unsettled_amount || 0) > 0);
    if (!unsettledRows.length) throw Object.assign(new Error("This user has no unsettled payments"), { status: 409 });
    const totalUnsettled = roundCurrency(unsettledRows.reduce((sum, row) => sum + Number(row.unsettled_amount || 0), 0));
    if (numericAmount > totalUnsettled) throw Object.assign(new Error(`Payment amount exceeds the user's unsettled balance of PHP ${totalUnsettled.toFixed(2)}`), { status: 400 });

    let remainingAmount = numericAmount;
    const settledRows = [];
    for (const row of unsettledRows) {
      if (remainingAmount <= 0) break;
      const appliedAmount = roundCurrency(Math.min(remainingAmount, roundCurrency(row.unsettled_amount)));
      const nextSettledAmount = roundCurrency(Number(row.settled_amount || 0) + appliedAmount);
      await repository.updateSettledAmount(row.id, nextSettledAmount, settledBy, conn);
      settledRows.push({ borrowing_id: row.id, book_title: row.book_title, applied_amount: appliedAmount });
      remainingAmount = roundCurrency(remainingAmount - appliedAmount);
    }
    await conn.commit();

    const refreshedOverview = await listUnsettledBorrowings({ userId: user.id });
    const remainingBalance = refreshedOverview.summary.total_unsettled_amount;
    try {
      await notificationsService.createNotification({
        type: "payment_settled",
        title: "Payment received",
        body: `A payment of PHP ${numericAmount.toFixed(2)} was recorded for your unsettled library fines. Remaining unsettled balance: PHP ${remainingBalance.toFixed(2)}.`,
        href: "/my-library",
        audienceType: "user",
        audienceUserId: user.id,
        createdBy: settledBy ?? null,
      });
    } catch (notificationError) {
      console.error("[borrowing] Failed to create payment notification:", notificationError);
    }
    return {
      message: remainingBalance > 0 ? "Payment recorded successfully" : "Payment recorded and all unsettled balances are cleared",
      user,
      settled_amount: numericAmount,
      remaining_balance: remainingBalance,
      settled_rows: settledRows,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = { getAdminPaymentOverview, getUserPaymentOverview, settleUserPayments };
