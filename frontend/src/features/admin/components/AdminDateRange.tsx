import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { AdminIcon } from './AdminIcon';
import type { DateRange } from 'react-day-picker';
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const display = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
export default function AdminDateRange({ from, to, onChange, presetMode = 'visits', labelOverride, extraPresets = [], footer }: {
    from: string;
    to: string;
    onChange: (from: string | null, to: string | null) => void;
    presetMode?: 'visits' | 'analytics' | 'reports' | 'audit';
    labelOverride?: ReactNode;
 footer?: ReactNode;
 extraPresets?: Array<{label:string;from:string;to:string}>;
}) { const [open, setOpen] = useState(false), [draft, setDraft] = useState<DateRange | undefined>(); const preset = (kind: string) => { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const today=['year','month','day'].map(key=>parts.find(part=>part.type===key)?.value).join('-'); const end = new Date(today+'T12:00:00'), start = new Date(end); if (kind === 'week')
    start.setDate(start.getDate() - (start.getDay() + 6) % 7); if (kind === '7d')
    start.setDate(start.getDate() - 6); if (kind === '30d')
    start.setDate(start.getDate() - 29); if (kind === 'month')
    start.setDate(1); if (kind === 'year')
    start.setMonth(0, 1); onChange(localDate(start), localDate(end)); setOpen(false); }; const presets = presetMode === 'audit' ? [['today','Today'],['7d','Last 7 days'],['30d','Last 30 days']] : presetMode === 'analytics' ? [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['year', 'This year']] : [['today', 'Today'], ['week', 'This week'], ['month', 'This month']]; return <Popover open={open} onOpenChange={value => { setOpen(value); if (value)
    setDraft(from ? { from: new Date(from + 'T12:00:00'), to: to ? new Date(to + 'T12:00:00') : undefined } : undefined); }}><PopoverTrigger asChild><Button type="button" variant="outline" title={presetMode === 'analytics' ? 'One period for charts and AI reports. Inventory is a current snapshot.' : undefined}><AdminIcon name="reservations"/>{labelOverride || (from ? `${display(from)}${to && to !== from ? ' – ' + display(to) : ''}` : presetMode === 'analytics' ? 'All time' : 'Visit dates')}</Button></PopoverTrigger><PopoverContent align="end" className="w-auto p-3 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto"><p className="text-sm font-medium mb-2">{presetMode === 'analytics' ? 'Analytics period' : presetMode === 'audit' ? 'Audit date range' : presetMode === 'reports' ? 'Report date range' : 'Visit date range'}</p><div className="flex gap-2 flex-wrap max-w-[280px]">{presets.map(([kind, label]) => <Button type="button" key={kind} variant="outline" size="sm" onClick={() => preset(kind)}>{label}</Button>)}{extraPresets.map(item=><Button type="button" variant="outline" size="sm" key={item.label} onClick={()=>{onChange(item.from,item.to);setOpen(false);}}>{item.label}</Button>)}{presetMode !== 'visits' && <Button type="button" variant="outline" size="sm" onClick={() => { setDraft(undefined); document.querySelector<HTMLElement>('[role=grid] button')?.focus(); }}>Custom</Button>}</div><Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={1}/><div className="flex justify-between gap-2"><Button type="button" variant="ghost" onClick={() => { onChange(null, null); setOpen(false); }}>{presetMode === 'analytics' ? 'All time' : 'All dates'}</Button><Button type="button" disabled={!draft?.from} onClick={() => { if (draft?.from)
    onChange(localDate(draft.from), localDate(draft.to || draft.from)); setOpen(false); }}>Apply range</Button></div>{footer}</PopoverContent></Popover>; }
