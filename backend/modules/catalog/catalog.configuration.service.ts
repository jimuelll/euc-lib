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
    const [archives] = await db.query(`SELECT s.\`key\`, e.actor_name, e.occurred_at
      FROM catalog_schema s JOIN audit_events e ON e.id = (
        SELECT MAX(a.id) FROM audit_events a
        JOIN JSON_TABLE(a.metadata, '$.changes[*]' COLUMNS (
          field_name VARCHAR(512) PATH '$.field', after_value VARCHAR(32) PATH '$.after'
        )) changeset
        WHERE a.route = '/api/admin/catalog-schema'
          AND RIGHT(changeset.field_name, CHAR_LENGTH(CONCAT('(', s.\`key\`, ') · archived'))) = CONCAT('(', s.\`key\`, ') · archived')
          AND changeset.after_value = 'Yes'
      ) WHERE s.archived = 1`);
    for (const row of archives) {
      if (summaries[row.key]) Object.assign(summaries[row.key],{archivedBy:row.actor_name,archivedAt:row.occurred_at});
    }
  }
  return {fields:summaries,activeRecords:{book:records.filter((r:any)=>!r.deleted_at&&r.material_type!=='thesis').length,thesis:records.filter((r:any)=>!r.deleted_at&&r.material_type==='thesis').length},unheldBooks:Number(unheld.total),generatedAt:new Date().toISOString()};
}
