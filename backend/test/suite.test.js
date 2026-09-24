const { after } = require("node:test");
const db = require("../db");

require("./analytics.helpers.test");
require("./admin.bulk-deactivation.test");
require("./audit.policy.test");
require("./accession.database.integration.test");
require("./cross-system.database.integration.test");
require("./architecture.test");
require("./backup.restore.test");
require("./backup.accession.restore.test");
require("./backup.transforms.test");
require("./borrowing.helpers.test");
require("./borrowing.archive.test");
require("./catalog.copy-lifecycle.test");
require("./catalog.image.test");
require("./catalog.public-search.test");
require("./delivery.outbox.test");
require("./holdings.accession.test");
require("./policy.removal.test");
require("./query.service.test");
require("./recommendations.images.test");
require("./recommendations.paging.test");
require("./report.service.test");
require("./reservation.visibility.test");

after(async () => db.end());
