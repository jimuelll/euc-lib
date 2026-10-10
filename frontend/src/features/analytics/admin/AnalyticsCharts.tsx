import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { AdminIcon, formatPeso } from '@/features/admin';
import type { NamedValue, TrendPoint } from './analytics.types';
export const colors = { blue: 'hsl(var(--admin-tone-blue))', green: 'hsl(var(--admin-tone-green))', red: 'hsl(var(--admin-tone-red))', amber: 'hsl(var(--admin-tone-amber))', purple: 'hsl(var(--admin-tone-purple))' };
export const shortDate = (value: string) => new Date(value.length === 7 ? value + '-01T12:00:00' : value + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: value.length === 7 ? undefined : 'numeric' });
export function Panel({ title, total, children }: {
    title?: string;
    total?: ReactNode;
    children: ReactNode;
}) { return <section className="analytics-panel">{(title || total !== undefined) && <header>{title && <h2>{title}</h2>}{total !== undefined && <strong>{total}</strong>}</header>}{children}</section>; }
export function DailyChart({ title, data, metrics, line = false, currency = false, emptyMessage = "No activity in this range", totalLabel, periodLabel }: {
    title: string;
    data: TrendPoint[];
    metrics: {
        key: string;
        label: string;
        color: string;
    }[];
    line?: boolean;
    currency?: boolean;
    emptyMessage?:string;
    totalLabel?:string;
    periodLabel?:string;
}) { const totals = metrics.map(metric => data.reduce((sum, row) => sum + Number(row[metric.key as keyof TrendPoint] || 0), 0)); const zeroDays = data.filter(row => metrics.every(metric => !Number(row[metric.key as keyof TrendPoint]))).length; const hasActivity = data.some(row=>metrics.some(metric=>Number(row[metric.key as keyof TrendPoint]||0)!==0)); const axis = <><CartesianGrid vertical={false} stroke="hsl(var(--border))"/><XAxis dataKey="label" tickFormatter={shortDate} interval="preserveStartEnd" minTickGap={30} axisLine={false} tickLine={false} tickMargin={10}/><YAxis width={currency ? 72 : 32} allowDecimals={false} domain={currency ? ['auto', 'auto'] : [0, 'auto']} tickFormatter={currency ? value => '₱' + Number(value).toLocaleString() : undefined} axisLine={false} tickLine={false}/><Tooltip labelFormatter={value => shortDate(String(value))} formatter={(value: number, name: string) => [currency ? formatPeso(Number(value)) : Number(value).toLocaleString(), metrics.find(metric => metric.key === name)?.label || name]} contentStyle={{ background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 6 }}/></>; return <Panel title={title} total={currency ? formatPeso(totals[0] || 0) : totalLabel || `${totals.reduce((sum, value) => sum + value, 0).toLocaleString()} recorded ${totals.reduce((sum,value)=>sum+value,0)===1 ? 'event' : 'events'}`}>{periodLabel && <p className="analytics-chart-period">{periodLabel}</p>}{!hasActivity ? <p className="analytics-empty">{emptyMessage}</p> : <div className="analytics-chart" role="img" aria-label={`${title}: ${metrics.map((metric, index) => `${metric.label} ${currency ? formatPeso(totals[index]) : totals[index]}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%">{line ? <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>{axis}{metrics.map(metric => <Line isAnimationActive={false} key={metric.key} type="linear" dataKey={metric.key} stroke={metric.color} strokeWidth={2} dot={data.length <= 31 ? { r: 2 } : false}/>)}</LineChart> : <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>{axis}{metrics.map(metric => <Bar isAnimationActive={false} key={metric.key} dataKey={metric.key} fill={metric.color} radius={[2, 2, 0, 0]}/>)}</BarChart>}</ResponsiveContainer></div>}<div className="analytics-legend">{metrics.map((metric, index) => <span key={metric.key}><i style={{ background: metric.color }}/>{metric.label}<strong>{currency ? formatPeso(totals[index]) : totals[index].toLocaleString()}</strong></span>)}</div>{currency && hasActivity && data.length > 0 && <p className="analytics-note">Peak {formatPeso(Math.max(...data.map(row => Number(row.settled_amount || 0))))} · {shortDate(data.reduce((peak, row) => Number(row.settled_amount || 0) > Number(peak.settled_amount || 0) ? row : peak, data[0]).label)}</p>}{hasActivity && zeroDays > 0 && <p className="analytics-note">{zeroDays} of {data.length} days had no activity in this range.</p>}</Panel>; }
const statusColor = (name: string) => /overdue|lost|damaged/i.test(name) ? colors.red : /returned|fulfilled|good/i.test(name) ? colors.green : /pending|ready|cancelled/i.test(name) ? colors.amber : colors.blue;
export function Distribution({ items, stacked = false }: {
    items: NamedValue[];
    stacked?: boolean;
}) { const total = items.reduce((sum, item) => sum + item.value, 0), max = Math.max(...items.map(item => item.value), 1); return total ? <><div className={stacked ? 'analytics-stacked' : 'sr-only'} aria-label="Status proportions">{items.filter(item => item.value > 0).map(item => <span key={item.name} style={{ flex: item.value, background: statusColor(item.name) }} title={`${item.name}: ${item.value}`}/>)}</div><ul className="analytics-distribution">{items.map(item => <li key={item.name}><div><span>{item.name.replace(/_/g, ' ')}</span><strong>{item.value.toLocaleString()} <small>({Math.round(item.value / total * 100)}%)</small></strong></div>{!stacked && <div className="analytics-track"><span style={{ width: `${item.value / max * 100}%`, background: statusColor(item.name) }}/></div>}</li>)}</ul></> : <p className="analytics-note">No data for this period.</p>; }
export function Snapshot({ label, value, href, attention = false }: {
    label: string;
    value: number | string;
    href?: string;
    attention?: boolean;
}) { const content = <><span>{label}</span><strong className={attention ? /overdue/i.test(label) ? 'analytics-danger' : 'analytics-attention' : ''}>{value}</strong>{href && <AdminIcon name="arrowRight"/>}</>; return href ? <Link className="analytics-snapshot-row" to={href}>{content}</Link> : <div className="analytics-snapshot-row">{content}</div>; }
export function Sparkline({ values, color }: {
    values: number[];
    color: string;
}) { const max = Math.max(...values, 1), points = values.map((value, index) => `${values.length > 1 ? index / (values.length - 1) * 100 : 50},${28 - value / max * 24}`).join(' '); return <svg viewBox="0 0 100 32" role="img" aria-label="Daily activity trend" className="analytics-spark"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>{values.length === 1 && <circle cx="50" cy={28 - values[0] / max * 24} r="2" fill={color}/>}</svg>; }

