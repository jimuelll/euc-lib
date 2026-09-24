const repository = require("./borrowing.repository");
const { listUnsettledBorrowings, syncOverdueBorrowings } = require("./overdue.helper");

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

module.exports = { getAdminPaymentOverview, getUserPaymentOverview };
