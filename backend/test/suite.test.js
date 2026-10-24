const { after } = require("node:test");
const db = require("../db");

require("./analytics.helpers.test");
require("./analytics.period.test");
require("./attendance.visits.test");
require("./rate-limit.test");
require("./auth-session.test");
require("./auth-session.database.integration.test");
require("./audit.policy.test");
require("./audit.lookup-labels.test");
require("./accession.database.integration.test");
require("./cross-system.database.integration.test");
require("./architecture.test");
require("./backup.restore.test");
require("./backup.accession.restore.test");
require("./backup.transforms.test");
require("./publishing.test");
require("./notifications.admin.test");
require("./borrowing.helpers.test");
require("./borrowing.desk-preview.test");
require("./reservation.admin-queue.test");
require("./borrowing.archive.test");
require("./borrowing.desk-undo.test");
require("./catalog.copy-lifecycle.test");
require("./catalog.desk.test");
require("./catalog.image.test");
require("./catalog.isbn-lookup.test");
require("./catalog.public-search.test");
require("./delivery.outbox.test");
require("./fine-calculation.test");
require("./clearance.desk.test");
require("./desk.permissions.test");
require("./staff.desk.integration.test");
require("./admin.users-desk.test");
require("./holdings.accession.test");
require("./numeric-input.test");
require("./policy.removal.test");
require("./query.service.test");
require("./recommendations.images.test");
require("./recommendations.backfill.test");
require("./recommendations.paging.test");
require("./report.service.test");
require("./reservation.visibility.test");

after(async () => db.end());
require('./query.export.test');

require('./academic-settings.test');
require('./book-type-policies.test');
require('./catalog.configuration.test');
require('./recommendations.admin.test');
require('./audit.feed.test');
require('./backup.safety.test.js');

require("./email.workflows.test");

require("./email.database.integration.test");

require("./profile.test");
require("./production-readiness.test");
require("./production-readiness.auth.test");
require("./production-readiness.database.integration.test");

require("./site-content.contacts.test");
