function copyLabel(copy = {}) {
  const barcode = typeof copy.barcode === "string" ? copy.barcode.trim() : "";
  const sequence = barcode.match(/-(\d+)$/)?.[1];
  if (sequence && Number(sequence) > 0) return `Copy ${Number(sequence)}`;
  if (barcode) return `Barcode ${barcode}`;
  return copy.id != null ? `Copy ID ${copy.id}` : "Copy";
}

function copyAuditTarget(route) {
  const match = String(route || "").match(/^\/api\/admin\/copies\/(\d+)(\/holding)?$/);
  return match ? { id: Number(match[1]), field: match[2] ? "holdings" : "condition" } : null;
}

function copyAuditDescription(route, copy, fallbackDescription = "") {
  const target = copyAuditTarget(route);
  if (!target) return fallbackDescription;
  const title = typeof copy?.title === "string" ? copy.title.trim() : "";
  const label = copyLabel({ id: target.id, barcode: copy?.barcode });
  const action = target.field === "holdings" ? "Updated holdings" : "Updated condition";
  return `${action}${title ? ` for “${title}”` : ""} · ${label}`;
}

async function enrichCopyAuditRows(rows, query) {
  const metadataFor = (row) => typeof row.metadata === "string" ? (() => {
    try { return JSON.parse(row.metadata); } catch { return {}; }
  })() : row.metadata;
  const targets = rows
    .filter((row) => !metadataFor(row)?.permanent_accession_event && !metadataFor(row)?.copy_display_description)
    .map((row) => ({ target: copyAuditTarget(row.route) })).filter(({ target }) => target);
  const ids = [...new Set(targets.map(({ target }) => target.id))];
  let copiesById = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    const [copies] = await query(
      `SELECT bc.id, bc.barcode, bk.title
       FROM book_copies bc LEFT JOIN books bk ON bk.id = bc.book_id
       WHERE bc.id IN (${placeholders})`,
      ids
    );
    copiesById = new Map(copies.map((copy) => [Number(copy.id), copy]));
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

module.exports = { copyLabel, copyAuditTarget, copyAuditDescription, enrichCopyAuditRows };
