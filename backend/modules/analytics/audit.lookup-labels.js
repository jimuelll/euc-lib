const lookupDefinitions = [
  {
    kind: "program",
    table: "academic_programs",
    labelColumn: "name",
    auditField: "Program / course",
    idFields: ["program_id"],
    matches: (route) => route.includes("/users") || route.includes("/holding"),
  },
  {
    kind: "term",
    table: "academic_terms",
    labelColumn: "name",
    auditField: "Academic term",
    idFields: ["academic_term_id"],
    matches: (route) => route.includes("/users"),
  },
  {
    kind: "department",
    table: "departments",
    labelColumn: "name",
    auditField: "Department",
    idFields: ["department_id"],
    matches: (route) => route.includes("/users"),
  },
  {
    kind: "book_type",
    table: "book_types",
    labelColumn: "name",
    auditField: "Book type",
    idFields: ["book_type_id"],
    matches: (route) => route.includes("/books") && !route.includes("/recommendations/"),
  },
  {
    kind: "book",
    table: "books",
    labelColumn: "title",
    auditField: "Book",
    idFields: ["book_id", "bookId"],
    matches: (route) => /\/(?:borrows|reservations|circulation)(?:\/|$)/.test(route),
  },
];

function definitionsForRoute(route = "") {
  return lookupDefinitions.filter((definition) => definition.matches(String(route)));
}

function definitionForChange(route, field) {
  const normalizedField = String(field || "").replace(/^Added\s+/i, "").trim().toLowerCase();
  return definitionsForRoute(route).find((definition) => definition.auditField.toLowerCase() === normalizedField) ?? null;
}

function numericId(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function lookupValueForSources(definition, sources = []) {
  for (const source of sources) {
    for (const key of definition.idFields) {
      const id = numericId(source?.[key]);
      if (id !== null) return id;
    }
  }
  return null;
}

async function queryLabels(query, definition, ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await query(
    `SELECT id, \`${definition.labelColumn}\` AS label FROM \`${definition.table}\` WHERE id IN (${placeholders})`,
    ids,
  );
  return new Map((rows || []).map((row) => [Number(row.id), String(row.label ?? "").trim()]));
}

async function labelsForSnapshots(query, route, before, after, body = {}) {
  const labels = {};
  await Promise.all(definitionsForRoute(route).map(async (definition) => {
    const sources = [after, before, body];
    const ids = [...new Set(sources.map((source) => lookupValueForSources(definition, [source])).filter((id) => id !== null))];
    if (!ids.length) return;
    try {
      const found = await queryLabels(query, definition, ids);
      labels[definition.kind] = Object.fromEntries(found);
    } catch {
      labels[definition.kind] = {};
    }
  }));
  return labels;
}

function parseMetadata(metadata) {
  if (typeof metadata !== "string") return metadata && typeof metadata === "object" ? metadata : {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function changeValues(change) {
  if (change && typeof change === "object" && change.field) {
    if (typeof change.value === "string") return ["value"];
    return ["before", "after"].filter((key) => typeof change[key] === "string");
  }
  return [];
}

function collectHistoricalIds(rows) {
  const idsByKind = new Map();
  for (const row of rows) {
    const metadata = parseMetadata(row.metadata);
    for (const change of Array.isArray(metadata.changes) ? metadata.changes : []) {
      const definition = definitionForChange(row.route, change?.field);
      if (!definition) continue;
      for (const key of changeValues(change)) {
        const id = numericId(change[key]);
        if (id === null) continue;
        if (!idsByKind.has(definition.kind)) idsByKind.set(definition.kind, new Set());
        idsByKind.get(definition.kind).add(id);
      }
    }
  }
  return idsByKind;
}

function displayHistoricalChange(route, change, labelsByKind) {
  const definition = definitionForChange(route, change?.field);
  if (!definition) return change;
  const labels = labelsByKind[definition.kind] || {};
  const keys = changeValues(change);
  if (!keys.length) return change;
  let display = change;
  for (const key of keys) {
    const id = numericId(change[key]);
    if (id === null) continue;
    if (display === change) display = { ...change };
    const name = labels[id];
    if (name) {
      display[key] = name;
      display.current_name = true;
    } else {
      display[key] = `ID ${id} (name unavailable)`;
    }
  }
  return display;
}

async function enrichAuditLookupRows(rows, query) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const idsByKind = collectHistoricalIds(rows);
  const labelsByKind = {};
  await Promise.all(lookupDefinitions.map(async (definition) => {
    const ids = [...(idsByKind.get(definition.kind) || [])];
    if (!ids.length) return;
    try {
      const found = await queryLabels(query, definition, ids);
      labelsByKind[definition.kind] = Object.fromEntries(found);
    } catch {
      labelsByKind[definition.kind] = {};
    }
  }));

  return rows.map((row) => {
    const metadata = parseMetadata(row.metadata);
    if (!Array.isArray(metadata.changes)) return row;
    const displayChanges = metadata.changes.map((change) => displayHistoricalChange(row.route, change, labelsByKind));
    return { ...row, display_changes: displayChanges };
  });
}

function applyCapturedLabels(route, changes, labelsByKind = {}) {
  return changes.map((change) => {
    const definition = definitionForChange(route, change.field);
    if (!definition) return change;
    const labels = labelsByKind[definition.kind] || {};
    const keys = changeValues(change);
    let display = change;
    for (const key of keys) {
      const id = numericId(change[key]);
      if (id === null) continue;
      if (display === change) display = { ...change };
      display[key] = labels[id] || `ID ${id} (name unavailable)`;
    }
    return display;
  });
}

module.exports = {
  applyCapturedLabels,
  definitionsForRoute,
  enrichAuditLookupRows,
  labelsForSnapshots,
};
