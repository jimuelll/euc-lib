const { enqueueAuditEvent } = require("./analytics.audit.service");
const { labelsForSnapshots } = require("./audit.lookup-labels");
const { metadataFor } = require("../../middlewares/auditLogger");

async function enqueueTransactionalAudit(conn, {
  actorId = null,
  route,
  action = "updated",
  description,
  before = null,
  after = null,
  details = null,
  type = "field_changes",
  category = "catalog",
  extraMetadata = {},
  isCreation = false,
}) {
  const comparable = before !== null && after !== null;
  let lookupLabels = {};
  try { lookupLabels = await labelsForSnapshots(conn, route, before, after); } catch { /* Keep audit writes available if a lookup table is unavailable. */ }
  const metadata = metadataFor(
    route,
    {},
    before,
    after,
    details,
    isCreation,
    { type },
    { failed: false, comparable, lookupLabels },
  );
  Object.assign(metadata, extraMetadata);
  await enqueueAuditEvent(conn, {
    actorId,
    category,
    action,
    description,
    route: route.slice(0, 255),
    metadata,
  });
  return metadata;
}

module.exports = { enqueueTransactionalAudit };
