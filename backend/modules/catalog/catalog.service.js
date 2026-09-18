// Stable catalog facade. Schema, availability, and catalogue query concerns
// are maintained in focused services while callers keep the existing API.
module.exports = {
  ...require("./catalog.schema.service"),
  ...require("./catalog.availability.service"),
  ...require("./catalog.query.service"),
};
