import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AdminStatusBadge, formatPeso } from '@/features/admin';
import type { QueryColumn, QueryRow } from './api';
import { formatQueryValue } from './format';
import { human } from './workspace.config';
export const moneyKeys = new Set(['assessedAmount', 'paidAmount', 'adjustedAmount', 'outstandingAmount', 'price']);
export const columnWidth = (column: QueryColumn) => column.key === 'title' ? 280 : Math.max(column.type === 'number' ? 160 : 180, column.label.length * 7 + 40);
export function recordCell(row: QueryRow, column: QueryColumn) {
    const value = row[column.key];
    if (moneyKeys.has(column.key)) return formatPeso(Number(value || 0));
    if (column.key === 'needsAccessionCopies' && Number(value) > 0) return <AdminStatusBadge status="pending">{formatQueryValue(value, 'number')}</AdminStatusBadge>;
    if (['isbn', 'barcode', 'accessionNumber', 'studentEmployeeId', 'copyId'].includes(column.key)) return <span className="records-mono">{value || '—'}</span>;
    if (['status', 'condition', 'materialType', 'accessionStatus', 'circulationState', 'role', 'borrowerRole'].includes(column.key)) {
        const name = String(value || '');
        return <AdminStatusBadge status={/outstanding|needs|overdue|damaged|lost/i.test(name) ? 'pending' : /returned|good|available|active|settled/i.test(name) ? 'eligible' : 'neutral'}>{human(name) || '—'}</AdminStatusBadge>;
    }
    if (['borrower', 'requester', 'name'].includes(column.key) && row.studentEmployeeId) return <Link className="records-link" to={'/admin/users?status=all&patron=' + encodeURIComponent(row.studentEmployeeId) + '&q=' + encodeURIComponent(row.studentEmployeeId)}>{value}</Link>;
    if (column.key === 'title' && row.bookId) return <Link className="records-link records-title" title={String(value)} to={'/admin/catalog?record=' + row.bookId}>{value}</Link>;
    return <span className={column.key === 'title' ? 'records-title' : ''} title={String(value || '')}>{formatQueryValue(value, column.key === 'createdAt' && column.label === 'Added' ? 'date' : column.type)}</span>;
}
export function RecordsTable({ columns, rows, totals, sort, direction, onSort }: {
    columns: QueryColumn[]; rows: QueryRow[]; totals?: Record<string, number>; sort?: string; direction?: string; onSort?: (key: string) => void;
}) {
    const header = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null);
    const width = columns.reduce((sum, column) => sum + columnWidth(column), 0);
    useLayoutEffect(() => { if (header.current && scroller.current) header.current.scrollLeft = scroller.current.scrollLeft; }, [columns]);
    const colgroup = <colgroup>{columns.map(column => <col key={column.key} style={{ width: columnWidth(column) }} />)}</colgroup>;
    const heading = (visual: boolean) => <thead className={visual ? undefined : 'records-accessible-head'}><tr>{columns.map(column => <th key={column.key} scope="col" className={column.type === 'number' ? 'records-number' : ''} aria-sort={sort === column.key ? direction === 'desc' ? 'descending' : 'ascending' : 'none'}>{visual && onSort ? <Button variant="ghost" size="sm" onClick={() => onSort(column.key)}>{column.label}{sort === column.key ? direction === 'desc' ? ' ↓' : ' ↑' : ''}</Button> : column.label}</th>)}</tr></thead>;
    return <div className="records-table-frame" style={{"--records-first-column": `${columns[0] ? columnWidth(columns[0]) : 0}px`} as CSSProperties}>
        <div className="records-sticky-header"><div ref={header} className="records-header-scroll"><table className="records-table" style={{ width, minWidth: width }} aria-label="Result column headings and sorting">{colgroup}{heading(true)}</table></div></div>
        <div ref={scroller} className="records-table-scroll" tabIndex={0} aria-label="Results table; scroll horizontally for more columns" onScroll={event => { if (header.current) header.current.scrollLeft = event.currentTarget.scrollLeft; }}>
            <table className="records-table" style={{ width, minWidth: width }}>{colgroup}{heading(false)}<tbody>{rows.map((row, index) => <tr key={String(row.bookId || row.studentEmployeeId || index) + '-' + index}>{columns.map(column => <td key={column.key} className={column.type === 'number' ? 'records-number' : ''}>{recordCell(row, column)}</td>)}</tr>)}</tbody>
            {totals && <tfoot><tr>{columns.map((column, index) => <td key={column.key} className={column.type === 'number' ? 'records-number' : ''}>{column.key in totals ? moneyKeys.has(column.key) ? formatPeso(totals[column.key]) : formatQueryValue(totals[column.key], 'number') : index === 0 ? 'All matching totals' : ''}</td>)}</tr></tfoot>}</table>
        </div>
    </div>;
}
