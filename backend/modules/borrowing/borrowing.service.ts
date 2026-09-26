// Stable facade for borrowing consumers. Domain responsibilities live in
// focused services while existing route/controller imports remain unchanged.
const read = require("./borrowing.read.service");
const transaction = require("./borrowing.transaction.service");
const admin = require("./borrowing.admin.service");
const payment = require("./borrowing.payment.service");

export = {
  ...read,
  ...transaction,
  ...admin,
  ...payment,
};
