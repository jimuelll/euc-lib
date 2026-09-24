const { enqueueAuditEvent } = require("./analytics.audit.service");
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
  const metadata = metadataFor(
    route,
    {},
    before,
    after,
    details,
    isCreation,
    { type },
    { failed: false, comparable },
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
