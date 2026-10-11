import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, Download } from '@/components/ui/library-glyphs';
import { exportRecords, type OutputResult } from './workspace.export.api';
import { RecordsTable } from './RecordsTable';
import type { Filters } from './workspace.config';
import { formatQueryGeneratedAt } from './format';
import { getApiErrorMessage } from '@/utils/apiError';
import './records.css';
export default function RecordsPrint({ report = false }: {
    report?: boolean;
}) { const [params] = useSearchParams(); const filters = useMemo(() => Object.fromEntries(params.entries()) as Filters, [params]); const columns = String(filters.columns || '').split(',').filter(Boolean); const query = useQuery<OutputResult>({ queryKey: ['admin-query', 'print', report, filters], queryFn: () => exportRecords(report, filters, columns, 'preview') as Promise<OutputResult>, retry: false }); const result = query.data; const [error, setError] = useState(''), [busy, setBusy] = useState(''); const download = async (format: 'csv' | 'excel') => { setBusy(format); try {
    await exportRecords(report, filters, result!.columns.map(c => c.key), format);
}
catch (e) {
    setError(getApiErrorMessage(e, 'Unable to export.'));
}
finally {
    setBusy('');
} }; return <main data-library-design className="records-print"><header><p>{result?.metadata?.libraryName || 'Library'}</p><h1>{result?.label || 'Report'}</h1><p>{result?.metadata?.period || 'All dates'} · {result?.rows.length || 0} rows · {result?.columns.length || 0} columns</p>{result?.metadata && <><p>Generated {formatQueryGeneratedAt(new Date(result.metadata.generatedAt))} · By {result.metadata.generatedBy}</p><p>Filters: {result.metadata.filters}</p></>}<div className="records-result-actions"><Button disabled={!result} onClick={() => window.print()}><Printer />Print / Save as PDF</Button><Button variant="outline" disabled={!result || !!busy} onClick={() => void download('excel')}><Download />Excel</Button><Button variant="outline" disabled={!result || !!busy} onClick={() => void download('csv')}><Download />CSV</Button></div></header>{(error || query.isError) && <p role="alert">{error || getApiErrorMessage(query.error, 'Unable to prepare the report.')}<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></p>}{query.isPending ? <p>Preparing printable report…</p> : result ? <RecordsTable columns={result.columns} rows={result.rows} totals={result.totals}/> : null}</main>; }
