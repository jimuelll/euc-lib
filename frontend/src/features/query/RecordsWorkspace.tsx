import { useContext, useEffect, useId, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X, Check, Columns3, Printer, Download, ChevronDown } from '@/components/ui/library-glyphs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AuthContext } from '@/context/AuthContext';
import { AdminDateRange, AdminIcon, useAdminFilters, formatAdminDate, type AdminIconName } from '@/features/admin';
import { toast } from '@/components/ui/sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { getApiErrorMessage } from '@/utils/apiError';
import { fetchQuery, fetchReport, fetchQueryMeta, type QueryFilters, type ReportFilters } from './api';
import { datasets, reports, labels, options, type Filters, defaultColumnKeys } from './workspace.config';
import { RecordsTable } from './RecordsTable';
import { exportRecords, readDownloads, rememberDownload, type OutputResult } from './workspace.export.api';
import './records.css';
export default function RecordsWorkspace({ report = false, onUpdated, refreshToken = 0 }: {
    report?: boolean;
    onUpdated?: (time: number) => void;
    refreshToken?: number;
}) {
    const user = useContext(AuthContext)?.user;
    const columnPickerId = useId();
    const [columnsOpen, setColumnsOpen] = useState(false);
    const typeKey = report ? 'report' : 'dataset', defaultType = report ? 'fined' : 'catalog';
    const { applied, setApplied, page, setPage } = useAdminFilters<Filters>(report ? 'report' : 'records', { [typeKey]: defaultType, search: '', dateFrom: '', dateTo: '' });
    const [draft, setDraft] = useState<Filters>(applied), [expanded, setExpanded] = useState(false), [hidden, setHidden] = useState<string[] | null>(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [downloads, setDownloads] = useState(readDownloads), [recent, setRecent] = useState<string[]>(() => { try {
        return JSON.parse(localStorage.getItem('library.records.recent-reports') || '[]');
    }
    catch {
        return [];
    } }), [presetName, setPresetName] = useState(''), [presets, setPresets] = useState<Array<{
        name: string;
        filters: Filters;
    }>>(() => { try {
        return JSON.parse(localStorage.getItem('library.records.presets') || '[]');
    }
    catch {
        return [];
    } });
    useEffect(() => setDraft(applied), [applied]);
    const choices = report ? reports : datasets, selected = choices.find(item => item.value === draft[typeKey]) || choices.find(item => item.value === defaultType)!, resultDefinition = choices.find(item => item.value === applied[typeKey]) || selected;
    const [pageSize, setPageSize] = useState(25);
    const debounced = useDebounce(String(draft.search || ''), 250);
    useEffect(() => { if (!report && debounced !== String(applied.search || ''))
        setApplied({ ...applied, search: debounced }); }, [debounced, report]);
    const meta = useQuery({ queryKey: ['query', 'meta'], queryFn: ({ signal }) => fetchQueryMeta(signal) });
    const requestFilters = { ...applied, ...(resultDefinition.snapshot ? { dateFrom: '', dateTo: '' } : {}) };
    const resultQuery = useQuery<OutputResult>({ queryKey: ['query', report ? 'reports' : 'records', applied, page, pageSize], queryFn: ({ signal }) => report ? fetchReport({ ...requestFilters, report: String(applied.report) as ReportFilters['report'], page, limit: pageSize }, signal) : fetchQuery({ ...requestFilters, dataset: String(applied.dataset) as QueryFilters['dataset'], page, limit: pageSize }, signal), placeholderData: keepPreviousData });
    const result = resultQuery.data as OutputResult | undefined, changed = report && JSON.stringify(draft) !== JSON.stringify(applied), loading = resultQuery.isFetching;
    useEffect(() => { if (resultQuery.dataUpdatedAt)
        onUpdated?.(resultQuery.dataUpdatedAt); }, [resultQuery.dataUpdatedAt, onUpdated]);
    useEffect(() => { if (refreshToken) void resultQuery.refetch(); }, [refreshToken]);
    const columnStorageKey = user ? 'library.records.columns.' + user.id + '.' + typeKey + '.' + applied[typeKey] : null;
    useEffect(() => {
        try {
            const saved = columnStorageKey ? JSON.parse(localStorage.getItem(columnStorageKey) || 'null') : null;
            setHidden(Array.isArray(saved) && saved.every(key => typeof key === 'string') ? saved : null);
        } catch { setHidden(null); }
    }, [columnStorageKey, applied[typeKey]]);
    const changeColumns = (keys: string[] | null) => {
        setHidden(keys);
        if (columnStorageKey) { try { if (keys === null) localStorage.removeItem(columnStorageKey); else localStorage.setItem(columnStorageKey, JSON.stringify(keys)); } catch { /* Column selection still works when storage is unavailable. */ } }
    };
    const defaults = defaultColumnKeys[String(applied[typeKey])] || (result?.columns || []).slice(0,7).map(column => column.key);
    const identityColumn = result?.columns.find(column => column.key === 'title') || result?.columns[0];
    const effectiveHidden = (hidden || (result?.columns || []).filter(column => !defaults.includes(column.key)).map(column => column.key)).filter(key => key !== identityColumn?.key);
    const columns = (result?.columns || []).filter(column => !effectiveHidden.includes(column.key));
    const active = Object.entries(draft).filter(([key, value]) => ![typeKey, 'sort', 'direction'].includes(key) && value !== '' && value !== 'all' && value !== undefined);
    const specific = active.filter(([key]) => selected.filters.includes(key));
    const update = (key: string, value: string) => { const next = { ...draft, [key]: value }; setDraft(next); if (!report && key !== 'search')
        setApplied(next); };
    const changeDates = (from: string | null, to: string | null) => { const next = { ...draft, dateFrom: from || '', dateTo: to || '' }; setDraft(next); if (!report)
        setApplied(next); };
    const choose = (value: string) => { const next = { [typeKey]: value, search: String(draft.search || ''), dateFrom: String(draft.dateFrom || ''), dateTo: String(draft.dateTo || '') }; setDraft(next); setApplied(next); setHidden(null); setError(''); toast.info('Type filters reset. Search and dates kept.'); };
    const reset = () => { const next = { [typeKey]: String(draft[typeKey]), search: '', dateFrom: '', dateTo: '' }; setDraft(next); if (!report)
        setApplied(next); };
    const run = () => { if (!changed && page === 1) void resultQuery.refetch(); setApplied({ ...draft }); setError(''); if (report) {
        const next = [String(draft.report), ...recent.filter(item => item !== draft.report)].slice(0, 5);
        setRecent(next);
        localStorage.setItem('library.records.recent-reports', JSON.stringify(next));
    } };
    const download = async (format: 'csv' | 'excel' | 'preview') => { setBusy(format); setError(''); const popup = format === 'preview' ? window.open('about:blank', '_blank') : null; try {
        if (format === 'preview') {
            if (!popup)
                throw new Error('Allow the print preview window, then try again.');
            const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(requestFilters).map(([k, v]) => [k, String(v)])), columns: columns.map(c => c.key).join(',') });
            popup.location.href = '/admin/query' + (report ? '/reports' : '') + '/preview?' + params;
        }
        else
            await exportRecords(report, requestFilters, columns.map(c => c.key), format);
        setDownloads(rememberDownload({ title: result?.label || resultDefinition.label, format: format === 'preview' ? 'Print / PDF view' : format === 'excel' ? 'Excel' : 'CSV', rows: result?.pagination?.total || 0, columns: columns.length, report, filters: applied }));
    }
    catch (e) {
        popup?.close();
        setError(getApiErrorMessage(e, 'Unable to export. Please try again.'));
    }
    finally {
        setBusy('');
    } };
    const savePreset = () => { if (!presetName.trim())
        return; const next = [{ name: presetName.trim(), filters: draft }, ...presets.filter(p => p.name !== presetName.trim())].slice(0, 12); setPresets(next); localStorage.setItem('library.records.presets', JSON.stringify(next)); setPresetName(''); toast.success('Preset saved on this device.'); };
    const applyPreset = (filters: Filters) => { setDraft(filters); if (!report)
        setApplied(filters); };
    return <div className="records-workspace"><div className="records-type"><label htmlFor={typeKey + '-type'}>{report ? 'Report type' : 'Record type'}</label><Select value={String(draft[typeKey])} onValueChange={choose}><SelectTrigger id={typeKey + '-type'}><SelectValue /></SelectTrigger><SelectContent className="records-type-menu">{report ? ['Circulation', 'Visitors', 'Collection', 'Patrons'].map(group => <SelectGroup key={group}><SelectLabel>{group}</SelectLabel>{reports.filter(item => item.group === group).map(item => <SelectItem value={item.value} key={item.value}><span className="records-menu-title"><AdminIcon name={item.icon as AdminIconName}/>{item.label}{recent.includes(item.value) && <small>Recent</small>}</span><span className="records-menu-description">{item.description}</span></SelectItem>)}</SelectGroup>) : datasets.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><p role="status" className="records-description">{selected.description}</p></div>
 <div className="records-filter-bar"><div className="records-search"><Search /><Input aria-label="Search records" placeholder={'Search ' + selected.label.toLowerCase() + '…'} value={String(draft.search || '')} onChange={e => update('search', e.target.value)}/></div><AdminDateRange from={String(draft.dateFrom || '')} to={String(draft.dateTo || '')} presetMode="reports" extraPresets={meta.data?.previousTerm ? [{ label: "Last semester", from: meta.data.previousTerm.from, to: meta.data.previousTerm.to }] : []} labelOverride={!draft.dateFrom && !draft.dateTo ? 'All dates' : undefined} onChange={changeDates} footer={<div className="records-presets records-date-presets"><strong>Saved presets</strong><p>Stored on this device.</p>{presets.filter(p => !!p.filters[typeKey]).map(p => <div key={p.name}><Button variant="ghost" onClick={() => applyPreset(p.filters)}>{p.name}</Button><Button variant="ghost" aria-label={'Remove preset ' + p.name} onClick={() => { const next = presets.filter(item => item.name !== p.name); setPresets(next); localStorage.setItem('library.records.presets', JSON.stringify(next)); }}><X /></Button></div>)}<Input aria-label="Preset name" placeholder="e.g. End of semester" maxLength={60} value={presetName} onChange={e => setPresetName(e.target.value)}/><Button disabled={!presetName.trim()} onClick={savePreset}>Save current filters</Button></div>}/>{selected.filters.length > 0 && <Button variant="outline" aria-expanded={expanded} aria-controls="records-specific" onClick={() => setExpanded(!expanded)}><SlidersHorizontal />Filters · {specific.length} active<ChevronDown /></Button>}{report && <Button onClick={run} disabled={loading}>{changed ? 'Run again' : 'Run report'}</Button>}</div>
 {selected.snapshot && <p className="records-description">Current snapshot. Saved dates apply when you switch to a dated type.</p>}
 {expanded && selected.filters.length > 0 && <div id="records-specific" className="records-specific">{selected.filters.map(key => <div key={key}><label htmlFor={'filter-' + key}>{labels[key]}</label><Select value={String(draft[key] || 'all')} onValueChange={value => update(key, value)}><SelectTrigger id={'filter-' + key}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{options(key, String(draft[typeKey]), meta.data).map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>)}</div>}
 {active.length > 0 && <div className="records-active" aria-label="Active filters">{active.map(([key, value]) => <Button variant="outline" size="sm" key={key} aria-label={'Remove ' + (labels[key] || key) + ' filter'} onClick={() => update(key, '')}>{labels[key] || key}: {options(key, String(draft[typeKey]), meta.data).find(item => item.value === String(value))?.label || (['dateFrom', 'dateTo'].includes(key) ? formatAdminDate(String(value), false) : value)}<X /></Button>)}<Button variant="ghost" size="sm" onClick={reset}>Reset filters</Button></div>}
 {(error || resultQuery.isError) && <div role="alert" className="records-error">{error || getApiErrorMessage(resultQuery.error, 'Unable to load results.')}<Button variant="outline" onClick={() => void resultQuery.refetch()}>Try again</Button></div>}
 {report && applied.report === 'fined' && <p className="records-description">Assessed amounts come from recorded fine ledger charges. Overdue loans can accrue additional charges at their saved policy rate.</p>}
 <section className="records-results" aria-busy={loading}>{changed && <div role="status" className="records-stale">Results out of date · Run again to apply the changed filters.</div>}<header><div><h2>{result?.label || resultDefinition.label}</h2><p role="status">{loading ? 'Updating results…' : ''}</p></div><div className="records-result-actions"><Button variant="outline" disabled={!result} aria-expanded={columnsOpen} aria-controls={columnPickerId} onClick={() => setColumnsOpen(!columnsOpen)}><Columns3 />Columns · {columns.length}</Button><div className="records-export"><span>Export {(result?.pagination?.total || 0).toLocaleString()} rows</span><div role="group" aria-label="Export matching records" className="records-export-formats">{(['preview','excel','csv'] as const).map(format => <Button key={format} variant="outline" disabled={!result || loading || changed || !!busy || !result.rows.length} title={`Export all ${result?.pagination?.total || 0} matching rows using the selected columns`} onClick={() => void download(format)}>{format === 'preview' ? <Printer /> : <Download />}{busy === format ? 'Preparing…' : format === 'preview' ? 'Print / PDF' : format === 'excel' ? 'Excel' : 'CSV'}</Button>)}</div></div></div></header><p className="records-export-summary">{(result?.pagination?.total || 0).toLocaleString()} rows · {columns.length} columns · {Object.entries(requestFilters).some(([key, v]) => ![typeKey, 'sort', 'direction'].includes(key) && v && v !== 'all') ? 'filters applied' : 'all records'} · Exports include all matching rows{result?.pagination?.total && result.pagination.total > 10000 ? ' · Narrow to 10,000 rows to export' : ''}</p>
 {columnsOpen && result && <section id={columnPickerId} className="records-column-picker" aria-label="Choose columns"><h3>Choose columns</h3><div className="records-column-toggles" role="group" aria-label="Visible columns">{result.columns.map(column => <button type="button" key={column.key} aria-pressed={!effectiveHidden.includes(column.key)} disabled={column.key === identityColumn?.key} title={column.key === identityColumn?.key ? 'Record identity stays visible' : undefined} onClick={() => changeColumns(effectiveHidden.includes(column.key) ? effectiveHidden.filter(key => key !== column.key) : [...effectiveHidden, column.key])}>{!effectiveHidden.includes(column.key) && <Check aria-hidden="true" />}{column.label}</button>)}</div><div className="records-column-shortcuts"><Button variant="outline" onClick={() => changeColumns([])}>Select all</Button><Button variant="outline" onClick={() => changeColumns(null)}>Default ({result.columns.filter(column => defaults.includes(column.key) || column.key === identityColumn?.key).length})</Button><Button variant="outline" onClick={() => changeColumns(result.columns.filter(column => column.key !== identityColumn?.key).map(column => column.key))}>{identityColumn?.label} only</Button></div></section>}
 {result?.rows.length ? <RecordsTable columns={columns} rows={result.rows} totals={result.totals} sort={String(applied.sort || '')} direction={String(applied.direction || '')} onSort={changed ? undefined : key => { const next = { ...applied, sort: key, direction: applied.sort === key && applied.direction !== 'desc' ? 'desc' : 'asc' }; setApplied(next); if (report)
        setDraft({ ...draft, sort: next.sort, direction: next.direction }); }}/> : !loading ? <p className="records-empty">No matching records. Adjust your filters or <Button variant="link" onClick={reset}>Reset filters</Button>.</p> : <p className="records-empty">Loading records…</p>}
 {!!result?.pagination && <footer><span>{result.pagination.total ? `${(result.pagination.page-1)*result.pagination.limit+1}–${Math.min(result.pagination.page*result.pagination.limit,result.pagination.total)} of ${result.pagination.total.toLocaleString()}` : '0 of 0'}</span><div className="records-page-size"><label htmlFor={typeKey+'-page-size'}>Rows per page</label><Select value={String(pageSize)} onValueChange={value=>{setPageSize(Number(value));setPage(1);}}><SelectTrigger id={typeKey+'-page-size'}><SelectValue /></SelectTrigger><SelectContent>{[25,50,100].map(size=><SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div>{result.pagination.totalPages>1 && <div className="records-pagination-actions"><Button variant="outline" disabled={loading || result.pagination.page<=1} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {result.pagination.page} of {result.pagination.totalPages}</span><Button variant="outline" disabled={loading || page>=result.pagination.totalPages} onClick={()=>setPage(page+1)}>Next</Button></div>}</footer>}</section>
 {downloads.length > 0 && <details className="records-downloads"><summary>Recent exports and print views <span>{downloads.length}</span></summary><p className="records-description">This device’s history. Re-run an entry to export current data.</p><ul>{downloads.map(item => <li key={item.id}><span>{item.title} · {item.format}<small>{formatAdminDate(item.at, true)} · {item.rows} rows · {item.columns} columns</small></span><Button variant="outline" disabled={item.report !== report} onClick={() => { setDraft(item.filters); setApplied(item.filters); }}>Use filters</Button></li>)}</ul></details>}
 </div>;
}
