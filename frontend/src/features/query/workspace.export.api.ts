import axios from '@/utils/AxiosInstance';
import type { QueryResult, ReportResult } from './api';
import type { Filters } from './workspace.config';
export type OutputResult = (QueryResult | ReportResult) & {
    totals?: Record<string, number>;
    metadata?: {
        libraryName: string;
        generatedBy: string;
        generatedAt: string;
        period: string;
        filters: string;
    };
};
export async function exportRecords(report: boolean, filters: Filters, columns: string[], format: 'csv' | 'excel' | 'preview') { const endpoint = '/api/admin/query' + (report ? '/reports' : '') + '/export'; const response = await axios.get(endpoint, { params: { ...filters, page: undefined, limit: undefined, columns: columns.join(','), format }, responseType: format === 'preview' ? 'json' : 'blob' }); if (format === 'preview')
    return response.data as OutputResult; const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = String(filters.report || filters.dataset) + (report ? '-report' : '-records') + (format === 'excel' ? '.xls' : '.csv'); link.click(); URL.revokeObjectURL(url); }
export type DownloadEntry = {
    id: string;
    title: string;
    format: string;
    at: string;
    rows: number;
    columns: number;
    report: boolean;
    filters: Filters;
};
const key = 'library.records.downloads.v1';
export function readDownloads(): DownloadEntry[] { try {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(items) ? items.slice(0, 10) : [];
}
catch {
    return [];
} }
export function rememberDownload(item: Omit<DownloadEntry, 'id' | 'at'>) { const items = [{ ...item, id: crypto.randomUUID(), at: new Date().toISOString() }, ...readDownloads()].slice(0, 10); localStorage.setItem(key, JSON.stringify(items)); return items; }
