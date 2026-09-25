const test = require("node:test");
const assert = require("node:assert/strict");
const audit = require("../middlewares/auditLogger");
const {
  enrichAuditLookupRows,
  labelsForSnapshots,
} = require("../modules/analytics/audit.lookup-labels");

function namesQuery(tables) {
  return async (sql, ids) => {
    const table = sql.match(/FROM `([^`]+)`/)?.[1];
    const records = tables[table] || [];
    return [records
      .filter((record) => ids.includes(Number(record.id)))
      .map((record) => ({ id: record.id, label: record.name ?? record.title }))];
  };
}

test("new user audit entries store lookup names and keep personal changes redacted", () => {
  const path = "/api/admin/users/S-123";
  const policy = audit.getAuditPolicy("PUT", path);
  const before = {
    id: 4, name: "A Person", student_employee_id: "S-123", email: "old@example.test", role: "student",
    is_active: 1, program_id: 2, academic_term_id: 8, department_id: 3,
  };
  const after = {
    ...before, name: "B Person", email: "new@example.test", program_id: 4,
    academic_term_id: null, department_id: 6,
  };
  const metadata = audit.metadataFor(path, {}, before, after, null, false, policy, {
    comparable: true,
    lookupLabels: {
      program: { 2: "Former program", 4: "Current program" },
      term: { 8: "2026–2027" },
      department: { 3: "Former department", 6: "Library services" },
    },
  });

  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Program / course"), {
    field: "Program / course", before: "Former program", after: "Current program",
  });
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Academic term"), {
    field: "Academic term", before: "2026–2027", after: "Cleared",
  });
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Department"), {
    field: "Department", before: "Former department", after: "Library services",
  });
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Name"), { field: "Name", value: "Changed" });
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Email"), { field: "Email", value: "Changed" });
});

test("event-time lookup resolves both sides of a changed reference and falls back clearly", async () => {
  const labels = await labelsForSnapshots(namesQuery({
    academic_programs: [{ id: 2, name: "Former name" }, { id: 4, name: "Renamed program" }],
  }), "/api/admin/users/:user", { program_id: 2 }, { program_id: 4 });
  const policy = audit.getAuditPolicy("PUT", "/api/admin/users/:user");
  const metadata = audit.metadataFor(
    "/api/admin/users/:user", {}, { program_id: 2 }, { program_id: 4 }, null, false, policy,
    { comparable: true, lookupLabels: labels },
  );
  assert.deepEqual(metadata.changes.find((entry) => entry.field === "Program / course"), {
    field: "Program / course", before: "Former name", after: "Renamed program",
  });

  const missing = audit.metadataFor(
    "/api/admin/users/:user", {}, { program_id: 2 }, { program_id: 9 }, null, false, policy,
    { comparable: true, lookupLabels: { program: { 2: "Former name" } } },
  );
  assert.deepEqual(missing.changes.find((entry) => entry.field === "Program / course"), {
    field: "Program / course", before: "Former name", after: "ID 9 (name unavailable)",
  });
});

test("holding programs, book policies, and book references resolve to their names", () => {
  const holding = audit.metadataFor(
    "/api/admin/copies/42/holding", {}, { program_id: 2 }, { program_id: 4 }, null, false,
    audit.getAuditPolicy("PUT", "/api/admin/copies/42/holding"),
    { comparable: true, lookupLabels: { program: { 2: "Former program", 4: "Current program" } } },
  );
  assert.deepEqual(holding.changes.find((entry) => entry.field === "Program / course"), {
    field: "Program / course", before: "Former program", after: "Current program",
  });

  const book = audit.metadataFor(
    "/api/admin/books/9", {}, { book_type_id: 2 }, { book_type_id: 4 }, null, false,
    audit.getAuditPolicy("PUT", "/api/admin/books/9"),
    { comparable: true, lookupLabels: { book_type: { 2: "General", 4: "Reference" } } },
  );
  assert.deepEqual(book.changes.find((entry) => entry.field === "Book type"), {
    field: "Book type", before: "General", after: "Reference",
  });

  const reservation = audit.metadataFor(
    "/api/reservations/9", {}, null, { id: 12, book_id: 4 },
    { stateFrom: "Not reserved", stateTo: "Pending", stateLabel: "Reservation status" }, true,
    audit.getAuditPolicy("POST", "/api/reservations/9"),
    { comparable: false, lookupLabels: { book: { 4: "The Library Book" } } },
  );
  assert.deepEqual(reservation.changes.find((entry) => entry.field === "Added Book"), {
    field: "Added Book", value: "The Library Book",
  });
});

test("historical audit display resolves current names without rewriting stored metadata", async () => {
  const metadata = JSON.stringify({
    changes: [
      { field: "Program / course", before: "2", after: "4" },
      { field: "Academic term", before: "8", after: "Cleared" },
      { field: "Department", before: "3", after: "6" },
      { field: "Email", value: "Changed" },
    ],
  });
  const rows = [{ route: "/api/admin/users/:user", metadata }];
  const enriched = await enrichAuditLookupRows(rows, namesQuery({
    academic_programs: [{ id: 2, name: "Current program 2" }, { id: 4, name: "Current program 4" }],
    academic_terms: [{ id: 8, name: "Current term" }],
    departments: [{ id: 3, name: "Current department 3" }, { id: 6, name: "Current department 6" }],
  }));

  assert.deepEqual(enriched[0].display_changes, [
    { field: "Program / course", before: "Current program 2", after: "Current program 4", current_name: true },
    { field: "Academic term", before: "Current term", after: "Cleared", current_name: true },
    { field: "Department", before: "Current department 3", after: "Current department 6", current_name: true },
    { field: "Email", value: "Changed" },
  ]);
  assert.equal(enriched[0].metadata, metadata);
});

test("historical book IDs resolve to current titles and missing rows keep labeled ID fallbacks", async () => {
  const rows = [
    { route: "/api/admin/reservations/:id", metadata: { changes: [{ field: "Book", before: "14", after: "19" }] } },
  ];
  const enriched = await enrichAuditLookupRows(rows, namesQuery({
    books: [{ id: 14, title: "Current title" }],
  }));
  assert.deepEqual(enriched[0].display_changes, [
    { field: "Book", before: "Current title", after: "ID 19 (name unavailable)", current_name: true },
  ]);
});

test("audit rows still display labeled ID fallbacks when lookup queries fail", async () => {
  const rows = [{
    route: "/api/admin/users/:user",
    metadata: JSON.stringify({ changes: [{ field: "Program / course", before: "2", after: "4" }] }),
  }];
  const enriched = await enrichAuditLookupRows(rows, async () => { throw new Error("database unavailable"); });
  assert.deepEqual(enriched[0].display_changes, [
    { field: "Program / course", before: "ID 2 (name unavailable)", after: "ID 4 (name unavailable)" },
  ]);
});
