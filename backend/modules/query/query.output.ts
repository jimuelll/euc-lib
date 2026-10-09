import queryFormat = require('./query.format');
export const moneyKeys = new Set(['assessedAmount', 'paidAmount', 'adjustedAmount', 'outstandingAmount', 'price']);
export function sortRows<T extends Record<string, any>>(rows: T[], filters: Record<string, any>, columns: Array<{
    key: string;
    type: string;
}>) { const column = columns.find(c => c.key === filters.sort); if (!column)
    return rows; const direction = filters.direction === 'desc' ? -1 : 1; return [...rows].sort((a, b) => direction * (column.type === 'number' ? Number(a[column.key] || 0) - Number(b[column.key] || 0) : ['date', 'dateTime'].includes(column.type) ? new Date(a[column.key] || 0).getTime() - new Date(b[column.key] || 0).getTime() : String(a[column.key] || '').localeCompare(String(b[column.key] || ''), 'en', { numeric: true }))); }
export function selectedColumns(columns: Array<{
    key: string;
    label: string;
    type: string;
}>, value: unknown) { if (!value)
    return columns; const names = String(value).split(','); const selected = names.map(key => columns.find(c => c.key === key)).filter((c): c is typeof columns[number] => !!c); if (!selected.length || selected.length !== names.length || new Set(names).size !== names.length)
    throw Object.assign(new Error('Choose valid export columns.'), { status: 400 }); return selected; }
export const xml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
export const safeCsv = (value: unknown) => '"' + String(value ?? '').replace(/^([\s]*[=+@-])/, "'$1").replace(/"/g, '""') + '"';
export function excelDocument(result: any, metadata: any) { const stringCell = (v: unknown) => '<Cell><Data ss:Type="String">' + xml(v) + '</Data></Cell>'; const row = (values: unknown[]) => '<Row>' + values.map(stringCell).join('') + '</Row>'; const rows = result.rows.map((item: any) => '<Row>' + result.columns.map((c: any) => c.type === 'number' ? '<Cell' + (moneyKeys.has(c.key) ? ' ss:StyleID="Money"' : '') + '><Data ss:Type="Number">' + Number(item[c.key] || 0) + '</Data></Cell>' : stringCell(queryFormat.formatQueryValue(item[c.key], c.type))).join('') + '</Row>'); return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Money"><NumberFormat ss:Format="₱#,##0.00"/></Style></Styles><Worksheet ss:Name="Report"><Table>' + row([metadata.libraryName]) + row([result.label]) + row(['Period', metadata.period]) + row(['Generated', metadata.generatedAt, 'By', metadata.generatedBy]) + row(['Filters', metadata.filters]) + row(result.columns.map((c: any) => c.label)) + rows.join('') + (result.totals ? row(result.columns.map((c: any) => c.key in result.totals ? '₱' + Number(result.totals[c.key]).toFixed(2) : c === result.columns[0] ? 'Totals' : '')) : '') + '</Table></Worksheet></Workbook>'; }
