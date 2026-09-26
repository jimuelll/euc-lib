const repository = require("./borrowing.repository");
import overdue = require("./overdue.helper");

const getAdminPaymentOverview = async ({ page = null, limit = 20 }: { page?: number | null; limit?: number } = {}) => {
  await overdue.syncOverdueBorrowings();
  const paymentOverview = await overdue.listUnsettledBorrowings({ page, limit });
  return { rows: paymentOverview.rows, summary: paymentOverview.summary, pagination: paymentOverview.pagination };
};

const getUserPaymentOverview = async (studentEmployeeId: string) => {
  const user = await repository.findUserForPaymentOverview(studentEmployeeId.trim());
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  const paymentOverview = await overdue.listUnsettledBorrowings({ userId: user.id });
  return { user, rows: paymentOverview.rows, summary: paymentOverview.summary };
};

export = { getAdminPaymentOverview, getUserPaymentOverview };
