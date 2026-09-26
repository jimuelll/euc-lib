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
  assert.doesNotMatch(read("modules/users/users.service.ts"), /require\(["']\.\.\/\.\.\/db["']\)/);
  assert.match(read("modules/users/users.repository.ts"), /require\(["']\.\.\/\.\.\/db["']\)/);
});

test("feature facades do not own database imports", () => {
  for (const relativePath of [
    "modules/borrowing/borrowing.service.ts",
    "modules/analytics/analytics.service.ts",
    "modules/catalog/catalog.service.ts",
  ]) {
    assert.doesNotMatch(read(relativePath), /require\(["']\.\.\/\.\.\/db["']\)/);
  }
});

test("repository-backed services delegate persistence to repositories", () => {
  const migratedServices = [
    ["modules/about/about.service.ts", "modules/about/about.repository.ts"],
    ["modules/events/events.service.ts", "modules/events/events.repository.ts"],
    ["modules/subscriptions/subscriptions.service.ts", "modules/subscriptions/subscriptions.repository.ts"],
    ["modules/site-content/site-content.service.ts", "modules/site-content/site-content.repository.ts"],
    ["modules/attendance/attendance.service.ts", "modules/attendance/attendance.repository.ts"],
    ["modules/auth/auth.service.ts", "modules/auth/auth.repository.ts"],
    ["modules/auth/authSession.service.ts", "modules/auth/auth-session.repository.ts"],
    ["modules/borrowing/borrowing.admin.service.ts", "modules/borrowing/borrowing.repository.ts"],
    ["modules/borrowing/borrowing.payment.service.ts", "modules/borrowing/borrowing.repository.ts"],
    ["modules/borrowing/borrowing.transaction.service.ts", "modules/borrowing/borrowing.repository.ts"],
    ["modules/circulation/circulation.service.ts", "modules/circulation/circulation.repository.ts"],
    ["modules/analytics/analytics.visitor.service.ts", "modules/analytics/analytics.repository.ts"],
    ["modules/analytics/analytics.audit.service.ts", "modules/analytics/analytics.repository.ts"],
    ["modules/analytics/analytics.dashboard.service.ts", "modules/analytics/analytics.repository.ts"],
    ["modules/analytics/aiReport.evidence.service.ts", "modules/analytics/analytics.repository.ts"],
    ["modules/backup/snapshot.restore.service.ts", "modules/backup/restore.repository.ts"],
    ["modules/bulletin/bulletin.service.ts", "modules/bulletin/bulletin.repository.ts"],
    ["modules/admin/admin.service.ts", "modules/admin/admin.repository.ts"],
    ["modules/recommendations/recommendations.service.ts", "modules/recommendations/recommendations.repository.ts"],
    ["modules/analytics/aiReport.question.service.ts", "modules/analytics/analytics.repository.ts"],
    ["modules/backup/snapshot.service.ts", "modules/backup/backup.repository.ts"],
    ["modules/backup/snapshot.storage.service.ts", "modules/backup/backup.repository.ts"],
    ["modules/catalog/catalog.availability.service.ts", "modules/catalog/catalog.repository.ts"],
    ["modules/catalog/catalog.query.service.ts", "modules/catalog/catalog.repository.ts"],
    ["modules/catalog/catalog.schema.service.ts", "modules/catalog/catalog.repository.ts"],
    ["modules/clearance/clearance.service.ts", "modules/clearance/clearance.repository.ts"],
    ["modules/my-library/my-library.service.ts", "modules/my-library/my-library.repository.ts"],
    ["modules/library-settings/library-settings.service.ts", "modules/library-settings/library-settings.repository.ts"],
    ["modules/notifications/notifications.service.ts", "modules/notifications/notifications.repository.ts"],
    ["modules/reservation/reservation.service.ts", "modules/reservation/reservation.repository.ts"],
    ["modules/user-guide/user-guide.service.ts", "modules/user-guide/user-guide.repository.ts"],
  ];
  const databaseImport = /(?:require\s*\(|from\s+)[^\n]*\bdb\b/;

  for (const [servicePath, repositoryPath] of migratedServices) {
    assert.doesNotMatch(read(servicePath), databaseImport, `${servicePath} must not import the database`);
    assert.match(read(repositoryPath), /require\(["']\.\.\/\.\.\/db["']\)/, `${repositoryPath} must own database access`);
  }
});

test("borrowing read service delegates SQL to its repository", () => {
  assert.doesNotMatch(read("modules/borrowing/borrowing.read.service.ts"), /require\(["']\.\.\/\.\.\/db["']\)/);
  assert.match(read("modules/borrowing/borrowing.repository.ts"), /require\(["']\.\.\/\.\.\/db["']\)/);
});

test("database-aware helpers delegate persistence to repositories", () => {
  for (const relativePath of [
    "modules/borrowing/overdue.helper.ts",
    "modules/catalog/catalog.middleware.ts",
  ]) {
    assert.doesNotMatch(read(relativePath), /(?:require\s*\(|from\s+)[^\n]*\bdb\b/, `${relativePath} must not import the database`);
  }
  assert.match(read("modules/borrowing/overdue.helper.ts"), /borrowing\.repository/);
  assert.match(read("modules/catalog/catalog.middleware.ts"), /getCatalogRecordForValidation/);
});

test("backend transport and scheduled files respect database boundaries", () => {
  const moduleFiles = walk(path.join(root, "modules"));
  const routeFiles = moduleFiles.filter((file) => /\.routes\.(?:js|ts)$/.test(file));
  const controllerFiles = moduleFiles.filter((file) => /\.controller\.(?:js|ts)$/.test(file));
  const jobFiles = walk(path.join(root, "jobs")).filter((file) => /\.js$|\.ts$/.test(file));

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
  const app = read("app.ts");
  assert.match(app, /require\("\.\/modules"\)/);
  assert.doesNotMatch(app, /modules\/(?:librarySettings|myLibrary|siteContent|userGuide)\//);
});
