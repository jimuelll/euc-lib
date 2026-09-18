// Stable analytics facade. Query responsibilities live in focused services.
module.exports = {
  ...require("./analytics.audit.service"),
  ...require("./analytics.dashboard.service"),
  ...require("./analytics.visitor.service"),
};
