const db = require('../../db');
const {hasAccession} = require('./copyEligibility');

// A missing value is distinct from a legitimate zero or false.
export const hasValue = (value:any):boolean => value !== undefined && value !== null &&
  (Array.isArray(value) ? value.some(hasValue) : typeof value === 'string' ? value.trim().length > 0 : true);

export function summarizeFieldUsage(fields:any[], records:any[]) {
  const result:Record<string,any> = {};
  for (const field of fields) {
    const summary = {used:0,activeUsed:0,archivedUsed:0,bookUsed:0,thesisUsed:0,missingBooks:0,missingTheses:0,publicUsed:0,options:{} as Record<string,number>};
    for (const record of records) {
      const metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata || '{}') : record.metadata || {};
      const value = Object.prototype.hasOwnProperty.call(record,field.key) ? record[field.key] : metadata[field.key];
      const book = record.material_type !== 'thesis';
      const applies = !field.scope || field.scope === 'shared' || field.scope === record.material_type;
      if (hasValue(value)) {
        summary.used++; summary[book?'bookUsed':'thesisUsed']++;
        summary[record.deleted_at?'archivedUsed':'activeUsed']++;
        if (!record.deleted_at && applies) summary.publicUsed++;
        if (field.type === 'select') summary.options[String(value)] = (summary.options[String(value)] || 0) + 1;
      } else if (!record.deleted_at) summary[book?'missingBooks':'missingTheses']++;
    }
    result[field.key] = summary;
  }
  return result;
}

export async function getConfigurationImpact() {
  const [fields] = await db.query('SELECT `key`, type, scope, archived FROM catalog_schema');
  const [records] = await db.query('SELECT material_type, metadata, title, author, isbn, copies, deleted_at FROM books');
  const [[unheld]] = await db.query(`SELECT COUNT(*) AS total FROM books b WHERE b.deleted_at IS NULL AND b.material_type='book'
    AND NOT EXISTS (SELECT 1 FROM book_copies bc JOIN copy_holdings h ON h.copy_id=bc.id
      WHERE bc.book_id=b.id AND bc.deleted_at IS NULL AND bc.is_active=1 AND bc.condition IN ('good','damaged') AND ${hasAccession('bc','h')})`);
  const summaries = summarizeFieldUsage(fields,records);
  if (fields.some((field:any) => field.archived)) {
    // Read the last archive transition for each still-archived field. Older
    // events without captured changes intentionally have no invented attribution.
    // JSON_TABLE is unavailable on older MariaDB installations. Decode the
    // captured changes here, keeping the same latest-event (highest id) rule.
    const [archives] = await db.query(`SELECT actor_name, occurred_at, metadata
      FROM audit_events WHERE route = ? ORDER BY id DESC`, ['/api/admin/catalog-schema']);
    const pending = new Set<string>(fields.filter((field:any) => field.archived).map((field:any) => field.key));
    for (const event of archives) {
      let metadata;
      try { metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata; }
      catch { continue; }
      if (!Array.isArray(metadata?.changes)) continue;
      for (const key of pending) {
        const suffix = `(${key}) · archived`;
        if (metadata.changes.some((change:any) => typeof change?.field === 'string' && change.field.endsWith(suffix) && change.after === 'Yes')) {
          Object.assign(summaries[key], {archivedBy:event.actor_name,archivedAt:event.occurred_at});
          pending.delete(key);
        }
      }
      if (!pending.size) break;
    }
  }
  return {fields:summaries,activeRecords:{book:records.filter((r:any)=>!r.deleted_at&&r.material_type!=='thesis').length,thesis:records.filter((r:any)=>!r.deleted_at&&r.material_type==='thesis').length},unheldBooks:Number(unheld.total),generatedAt:new Date().toISOString()};
}
