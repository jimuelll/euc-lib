type LookupKind = "program" | "term" | "department" | "book_type" | "book";
interface LookupDefinition {
  kind: LookupKind;
  table: string;
  labelColumn: string;
  auditField: string;
  idFields: string[];
  matches: (route: string) => boolean;
}
interface AuditRow extends Record<string, any> {
  route: string;
  metadata?: unknown;
}

const lookupDefinitions: LookupDefinition[] = [
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

function definitionsForRoute(route = ""): LookupDefinition[] {
  return lookupDefinitions.filter((definition) => definition.matches(String(route)));
}

function definitionForChange(route: string, field: unknown): LookupDefinition | null {
  const normalizedField = String(field || "").replace(/^Added\s+/i, "").trim().toLowerCase();
  return definitionsForRoute(route).find((definition) => definition.auditField.toLowerCase() === normalizedField) ?? null;
}

function numericId(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function lookupValueForSources(definition: LookupDefinition, sources: Array<Record<string, any> | null | undefined> = []): number | null {
  for (const source of sources) {
    for (const key of definition.idFields) {
      const id = numericId(source?.[key]);
      if (id !== null) return id;
    }
  }
  return null;
}

async function queryLabels(query: any, definition: LookupDefinition, ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await query(
    `SELECT id, \`${definition.labelColumn}\` AS label FROM \`${definition.table}\` WHERE id IN (${placeholders})`,
    ids,
  );
  return new Map<number, string>((rows || []).map((row: Record<string, any>) => [Number(row.id), String(row.label ?? "").trim()]));
}

async function labelsForSnapshots(query: any, route: string, before: Record<string, any> | null, after: Record<string, any> | null, body: Record<string, any> = {}): Promise<Record<string, Record<string, string>>> {
  const labels: Record<string, Record<string, string>> = {};
  await Promise.all(definitionsForRoute(route).map(async (definition) => {
    const sources = [after, before, body];
    const ids = [...new Set(sources.map((source) => lookupValueForSources(definition, [source])).filter((id): id is number => id !== null))];
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

function parseMetadata(metadata: unknown): Record<string, any> {
  if (typeof metadata !== "string") return metadata && typeof metadata === "object" ? metadata : {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function changeValues(change: any): string[] {
  if (change && typeof change === "object" && change.field) {
    if (typeof change.value === "string") return ["value"];
    return ["before", "after"].filter((key) => typeof change[key] === "string");
  }
  return [];
}

function collectHistoricalIds(rows: AuditRow[]): Map<LookupKind, Set<number>> {
  const idsByKind = new Map<LookupKind, Set<number>>();
  for (const row of rows) {
    const metadata = parseMetadata(row.metadata);
    for (const change of Array.isArray(metadata.changes) ? metadata.changes : []) {
      const definition = definitionForChange(row.route, change?.field);
      if (!definition) continue;
      for (const key of changeValues(change)) {
        const id = numericId(change[key]);
        if (id === null) continue;
        const ids = idsByKind.get(definition.kind) ?? new Set<number>();
        ids.add(id);
        idsByKind.set(definition.kind, ids);
      }
    }
  }
  return idsByKind;
}

function displayHistoricalChange(route: string, change: any, labelsByKind: Record<string, Record<string, string>>): any {
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

async function enrichAuditLookupRows(rows: AuditRow[], query: any): Promise<AuditRow[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const idsByKind = collectHistoricalIds(rows);
  const labelsByKind: Record<string, Record<string, string>> = {};
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

function applyCapturedLabels(route: string, changes: any[], labelsByKind: Record<string, Record<string, string>> = {}): any[] {
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

export = {
  applyCapturedLabels,
  definitionsForRoute,
  enrichAuditLookupRows,
  labelsForSnapshots,
};
