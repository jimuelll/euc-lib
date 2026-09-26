// Stable catalog facade. Schema, availability, and catalogue query concerns
// are maintained in focused services while callers keep the existing API.
import schema = require("./catalog.schema.service");
import availability = require("./catalog.availability.service");
import query = require("./catalog.query.service");

export = {
  ...schema,
  ...availability,
  ...query,
};
