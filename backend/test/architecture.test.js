const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});

test("users service delegates persistence to its repository", () => {
  assert.doesNotMatch(read("modules/users/users.service.js"), /require\(["']\.\.\/\.\.\/db["']\)/);
  assert.match(read("modules/users/users.repository.js"), /require\(["']\.\.\/\.\.\/db["']\)/);
});

test("feature facades do not own database imports", () => {
  for (const relativePath of [
    "modules/borrowing/borrowing.service.js",
    "modules/analytics/analytics.service.js",
    "modules/catalog/catalog.service.js",
  ]) {
    assert.doesNotMatch(read(relativePath), /require\(["']\.\.\/\.\.\/db["']\)/);
  }
});

test("repository-backed services delegate persistence to repositories", () => {
  const migratedServices = [
    ["modules/about/about.service.js", "modules/about/about.repository.js"],
    ["modules/attendance/attendance.service.js", "modules/attendance/attendance.repository.js"],
    ["modules/auth/auth.service.js", "modules/auth/auth.repository.js"],
    ["modules/auth/authSession.service.js", "modules/auth/auth-session.repository.js"],
    ["modules/borrowing/borrowing.admin.service.js", "modules/borrowing/borrowing.repository.js"],
    ["modules/borrowing/borrowing.payment.service.js", "modules/borrowing/borrowing.repository.js"],
    ["modules/borrowing/borrowing.transaction.service.js", "modules/borrowing/borrowing.repository.js"],
    ["modules/circulation/circulation.service.js", "modules/circulation/circulation.repository.js"],
    ["modules/analytics/analytics.visitor.service.js", "modules/analytics/analytics.repository.js"],
    ["modules/analytics/analytics.audit.service.js", "modules/analytics/analytics.repository.js"],
    ["modules/analytics/analytics.dashboard.service.js", "modules/analytics/analytics.repository.js"],
    ["modules/analytics/aiReport.evidence.service.js", "modules/analytics/analytics.repository.js"],
    ["modules/backup/snapshot.restore.service.js", "modules/backup/restore.repository.js"],
    ["modules/bulletin/bulletin.service.js", "modules/bulletin/bulletin.repository.js"],
    ["modules/admin/admin.service.js", "modules/admin/admin.repository.js"],
    ["modules/recommendations/recommendations.service.js", "modules/recommendations/recommendations.repository.js"],
    ["modules/analytics/aiReport.question.service.js", "modules/analytics/analytics.repository.js"],
    ["modules/backup/snapshot.service.js", "modules/backup/backup.repository.js"],
    ["modules/backup/snapshot.storage.service.js", "modules/backup/backup.repository.js"],
    ["modules/catalog/catalog.availability.service.js", "modules/catalog/catalog.repository.js"],
    ["modules/catalog/catalog.query.service.js", "modules/catalog/catalog.repository.js"],
    ["modules/catalog/catalog.schema.service.js", "modules/catalog/catalog.repository.js"],
    ["modules/clearance/clearance.service.js", "modules/clearance/clearance.repository.js"],
    ["modules/my-library/my-library.service.js", "modules/my-library/my-library.repository.js"],
    ["modules/library-settings/library-settings.service.js", "modules/library-settings/library-settings.repository.js"],
    ["modules/notifications/notifications.service.js", "modules/notifications/notifications.repository.js"],
    ["modules/reservation/reservation.service.js", "modules/reservation/reservation.repository.js"],
    ["modules/subscriptions/subscriptions.service.js", "modules/subscriptions/subscriptions.repository.js"],
    ["modules/user-guide/user-guide.service.js", "modules/user-guide/user-guide.repository.js"],
  ];
  const databaseImport = /(?:require\s*\(|from\s+)[^\n]*\bdb\b/;

  for (const [servicePath, repositoryPath] of migratedServices) {
    assert.doesNotMatch(read(servicePath), databaseImport, `${servicePath} must not import the database`);
    assert.match(read(repositoryPath), /require\(["']\.\.\/\.\.\/db["']\)/, `${repositoryPath} must own database access`);
  }
});

test("borrowing read service delegates SQL to its repository", () => {
  assert.doesNotMatch(read("modules/borrowing/borrowing.read.service.js"), /require\(["']\.\.\/\.\.\/db["']\)/);
  assert.match(read("modules/borrowing/borrowing.repository.js"), /require\(["']\.\.\/\.\.\/db["']\)/);
});

test("database-aware helpers delegate persistence to repositories", () => {
  for (const relativePath of [
    "modules/borrowing/overdue.helper.js",
    "modules/catalog/catalog.middleware.js",
  ]) {
    assert.doesNotMatch(read(relativePath), /(?:require\s*\(|from\s+)[^\n]*\bdb\b/, `${relativePath} must not import the database`);
  }
  assert.match(read("modules/borrowing/overdue.helper.js"), /borrowing\.repository/);
  assert.match(read("modules/catalog/catalog.middleware.js"), /getCatalogRecordForValidation/);
});

test("backend transport and scheduled files respect database boundaries", () => {
  const moduleFiles = walk(path.join(root, "modules"));
  const routeFiles = moduleFiles.filter((file) => file.endsWith(".routes.js"));
  const controllerFiles = moduleFiles.filter((file) => file.endsWith(".controller.js"));
  const jobFiles = walk(path.join(root, "jobs")).filter((file) => file.endsWith(".js"));

  for (const file of routeFiles) {
    const contents = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(contents, /(?:require\s*\(|from\s+)[^\n]*\bdb\b/, `${file} must not import the database`);
    assert.doesNotMatch(contents, /require\(["'][^"']*\.service["']\)/, `${file} must delegate through a controller`);
  }
  for (const file of controllerFiles) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /(?:require\s*\(|from\s+)[^\n]*\bdb\b/, `${file} must delegate database work`);
  }
  for (const file of jobFiles) {
    const contents = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(contents, /(?:require\s*\(|from\s+)[^\n]*(?:\bdb\b|\.repository)/, `${file} must call a service`);
  }
});

test("module registry is the stable route registration boundary", () => {
  const app = read("app.js");
  assert.match(app, /require\("\.\/modules"\)/);
  assert.doesNotMatch(app, /modules\/(?:librarySettings|myLibrary|siteContent|userGuide)\//);
});
