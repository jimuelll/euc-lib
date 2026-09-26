interface CopyLike {
  id?: number | string | null;
  barcode?: unknown;
  title?: unknown;
}
interface AuditRow extends Record<string, any> {
  route?: string;
  metadata?: unknown;
  description?: string;
}
interface CopyAuditTarget {
  id: number;
  field: "holdings" | "condition";
}

function copyLabel(copy: CopyLike = {}): string {
  const barcode = typeof copy.barcode === "string" ? copy.barcode.trim() : "";
  const sequence = barcode.match(/-(\d+)$/)?.[1];
  if (sequence && Number(sequence) > 0) return `Copy ${Number(sequence)}`;
  if (barcode) return `Barcode ${barcode}`;
  return copy.id != null ? `Copy ID ${copy.id}` : "Copy";
}

function copyAuditTarget(route: unknown): CopyAuditTarget | null {
  const match = String(route || "").match(/^\/api\/admin\/copies\/(\d+)(\/holding)?$/);
  return match ? { id: Number(match[1]), field: match[2] ? "holdings" : "condition" } : null;
}

function copyAuditDescription(route: unknown, copy: CopyLike | null | undefined, fallbackDescription = ""): string {
  const target = copyAuditTarget(route);
  if (!target) return fallbackDescription;
  const title = typeof copy?.title === "string" ? copy.title.trim() : "";
  const label = copyLabel({ id: target.id, barcode: copy?.barcode });
  const action = target.field === "holdings" ? "Updated holdings" : "Updated condition";
  return `${action}${title ? ` for “${title}”` : ""} · ${label}`;
}

async function enrichCopyAuditRows(rows: AuditRow[], query: any): Promise<AuditRow[]> {
  const metadataFor = (row: AuditRow): any => typeof row.metadata === "string" ? (() => {
    try { return JSON.parse(row.metadata); } catch { return {}; }
  })() : row.metadata;
  const targets = rows
    .filter((row) => !metadataFor(row)?.permanent_accession_event && !metadataFor(row)?.copy_display_description)
    .map((row) => ({ target: copyAuditTarget(row.route) }))
    .filter((entry): entry is { target: CopyAuditTarget } => Boolean(entry.target));
  const ids = [...new Set(targets.map(({ target }) => target.id))];
  let copiesById = new Map<number, CopyLike>();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    const [copies] = await query(
      `SELECT bc.id, bc.barcode, bk.title
       FROM book_copies bc LEFT JOIN books bk ON bk.id = bc.book_id
       WHERE bc.id IN (${placeholders})`,
      ids
    );
    copiesById = new Map(copies.map((copy: CopyLike & { id: number }) => [Number(copy.id), copy]));
  }
  return rows.map((row) => {
    const target = copyAuditTarget(row.route);
    const { route, ...publicRow } = row;
    if (!target) return publicRow;
    const metadata = metadataFor(row);
    // Accession claims persist independently from restored copy IDs. Their
    // transaction-time title and barcode sequence are the stable audit label.
    if (metadata?.permanent_accession_event) return publicRow;
    if (typeof metadata?.copy_display_description === "string" && metadata.copy_display_description.trim()) {
      return { ...publicRow, copy_display_description: metadata.copy_display_description };
    }
    return {
      ...publicRow,
      copy_display_description: copyAuditDescription(route, copiesById.get(target.id) ?? { id: target.id }, row.description),
    };
  });
}

export = { copyLabel, copyAuditTarget, copyAuditDescription, enrichCopyAuditRows };
