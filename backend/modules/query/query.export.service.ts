const db = require('../../db');
const audit = require('../analytics/audit.service');
export async function prepareExport(result: any, query: Record<string, any>, user: {
    id: number;
    role: string;
}, format: string) {
    const [[person]] = await db.query('SELECT name FROM users WHERE id=?', [user.id]);
    const [[library]] = await db.query('SELECT library_name FROM about_settings LIMIT 1');
    const filters = Object.entries(result.filters || {}).filter(([key, value]) => !['format', 'columns', 'page', 'limit', 'sort', 'direction'].includes(key) && value && value !== 'all').map(([key, value]) => key + ': ' + value).join(' · ') || 'All records';
    result.metadata = { libraryName: library?.library_name || 'Library', generatedBy: person?.name || 'Library administrator', generatedAt: new Date().toISOString(), period: (query.dateFrom || query.dateTo) ? String(query.dateFrom || 'Beginning') + ' – ' + String(query.dateTo || 'Present') : 'All dates', filters };
    await audit.recordAuditEvent({ actorId: user.id, action: format === 'preview' ? 'report_export_prepared' : 'report_exported', category: 'reports', route: '/admin/query', metadata: { type: result.report || result.dataset, format, rows: result.rows.length, columns: result.columns.map((c: any) => c.key), filters: result.filters }, description: 'Exported ' + result.label + ' (' + format + ')' });
    return result;
}
