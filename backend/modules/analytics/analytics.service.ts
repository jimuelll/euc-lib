// Stable analytics facade. Query responsibilities live in focused services.
import audit = require("./analytics.audit.service");
import dashboard = require("./analytics.dashboard.service");
import visitor = require("./analytics.visitor.service");

export = {
  ...audit,
  ...dashboard,
  ...visitor,
};
