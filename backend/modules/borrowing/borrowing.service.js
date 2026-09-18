// Stable facade for borrowing consumers. Domain responsibilities live in
// focused services while existing route/controller imports remain unchanged.
module.exports = {
  ...require("./borrowing.read.service"),
  ...require("./borrowing.transaction.service"),
  ...require("./borrowing.admin.service"),
  ...require("./borrowing.payment.service"),
};
