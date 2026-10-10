import { formatAdminDate, formatPeso } from '@/features/admin';
import type { DashboardResponse } from './analytics.types';
import type { AiAnalyticsReportResponse } from '../api/adminAnalytics.api';
export interface AnalyticsExportMeta {libraryName:string;generatedBy:string;title:string;period:string;generatedAt:string}
export type AnalyticsExportRow = [string,string,string|number,string,string];
const readable = (key:string) => key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,char=>char.toUpperCase());
export function analyticsRows(data:DashboardResponse,tab:string,period:string,report:AiAnalyticsReportResponse|null):AnalyticsExportRow[]{
 const rows:AnalyticsExportRow[]=[];
 const groups:Record<string,string[]>={overview:['circulationTrend','attendanceTrend','visitTrend'],circulation:['circulationTrend','reservationTrend','borrowingStatus','popularBooks','fineCollectionTrend','borrowingByRole'],visitors:['attendanceTrend','visitTrend','userRoles'],collection:['catalogByCategory','copyCondition']};
 if(tab==='ai-report'){if(report)rows.push(['AI Report','Brief',report.report,report.generatedAt,`${report.range.dateFrom} – ${report.range.dateTo}`]);return rows;}
 for(const name of groups[tab]||[]){const items=data.charts[name as keyof DashboardResponse['charts']];for(const item of items){for(const [metric,value] of Object.entries(item)){if(metric==='name'||metric==='label')continue;rows.push([name,'name' in item ? String(item.name)+' · '+metric : metric,value as string|number,'label' in item ? item.label : 'Current snapshot','label' in item ? period : 'Current snapshot']);}}}
 if(tab==='overview'||tab==='collection'){for(const key of tab==='overview'?['overdue_borrowings','ready_reservations','outstanding_fines']:['total_book_copies','active_accessioned_copies','needs_accession_copies','available_book_copies','borrowed_book_copies'])rows.push(['Snapshot',key,data.stats[key as keyof typeof data.stats],'Current snapshot','Current snapshot']);}
 return rows.map(row=>[readable(row[0]),readable(row[1]),...row.slice(2)] as AnalyticsExportRow);
}
export function downloadAnalyticsCsv(rows:AnalyticsExportRow[],meta:AnalyticsExportMeta){
 const cell=(value:unknown)=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const content=[[meta.libraryName],[meta.title],['Period',meta.period],['Generated',formatAdminDate(meta.generatedAt),'By',meta.generatedBy],['Section','Metric','Value','Date','Scope'],...rows].map(row=>row.map(cell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=meta.title.replace(/[^a-z0-9]+/gi,'-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function printAnalytics(rows:AnalyticsExportRow[],meta:AnalyticsExportMeta){
 const popup=window.open('','_blank');if(!popup)throw new Error('Allow the print preview window, then try again.');
 const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 const body=rows.map(row=>'<tr>'+row.map((value,index)=>'<td>'+escape(index===2&&/amount|fines/i.test(row[1])&&typeof value==='number'?formatPeso(value):value)+'</td>').join('')+'</tr>').join('');
 popup.document.write(`<!doctype html><html><head><title>${escape(meta.title)}</title><style>body{font-family:system-ui,sans-serif;color:#17202a;margin:32px;font-size:12px}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{border-bottom:1px solid #ccc;padding:8px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px;margin:12px 0}@media print{button{display:none}@page{size:landscape;margin:14mm}body{margin:0}}</style></head><body><p>${escape(meta.libraryName)}</p><h1>${escape(meta.title)}</h1><p>${escape(meta.period)} · Reporting time zone UTC+08</p><p>Generated ${escape(formatAdminDate(meta.generatedAt))} · By ${escape(meta.generatedBy)}</p><p>Activity uses the selected range. Collection, loan status and outstanding fines are current snapshots.</p><button onclick="window.print()">Print / Save as PDF</button><table><thead><tr><th>Section</th><th>Metric</th><th>Value</th><th>Date</th><th>Scope</th></tr></thead><tbody>${body}</tbody></table></body></html>`);popup.document.close();popup.focus();
}
