const service = require("./clearance.service");
const respond = (handler) => async (req, res) => { try { res.json(await handler(req)); } catch (error) { console.error("[clearance]", error); res.status(error.status || 500).json({ message: error.message || "Clearance request failed", clearance: error.clearance }); } };
exports.getProfile = respond((req) => service.getClearanceProfile(req.query.student_employee_id));
exports.getQueue = respond((req) => service.getClearanceQueue({
  page: req.query.page === undefined ? undefined : Number(req.query.page),
  limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
}));
exports.recordPayment = respond((req) => service.recordFullPayment({ studentEmployeeId: req.body?.student_employee_id, createdBy: req.user.id }));
exports.adjustFine = respond((req) => service.adjustFine({ borrowingId: Number(req.params.borrowingId), amount: req.body?.amount, reason: req.body?.reason, createdBy: req.user.id }));
exports.reverseTransaction = respond((req) => service.reverseTransaction({ transactionId: Number(req.params.transactionId), reason: req.body?.reason, createdBy: req.user.id }));
exports.getReceipt = respond((req) => service.getReceipt(req.params.receiptNumber));
