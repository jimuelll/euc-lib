import { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdminIcon } from './AdminIcon';
export function formatAdminDate(value: unknown, includeTime = true) { if (!value)
    return '—'; const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value)+"T00:00:00" : String(value)); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(date) : '—'; }
export function AdminDateTime({ label, value, onChange, optional = false, dateOnly = false }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    optional?: boolean;
    dateOnly?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const date = value ? new Date(dateOnly ? value.slice(0,10)+"T00:00:00" : value) : undefined;
    const valid = date && Number.isFinite(date.getTime());
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = valid ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "09:00";
    return <div className="content-field admin-form-field"><Label id={id}>{label}</Label><div className="publishing-date-time admin-date-time"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" aria-labelledby={id}><AdminIcon name="reservations"/>{valid ? formatAdminDate(value, false) : "Choose date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-3" align="start"><Calendar mode="single" selected={valid ? date : undefined} onSelect={selected => {
            if (selected) {
                onChange(dateOnly ? day(selected) : day(selected) + "T" + time + ":00");
                setOpen(false);
            }
        }} initialFocus/></PopoverContent></Popover>{!dateOnly && <Input type="time" aria-label={`${label} time`} value={time} disabled={!valid} onChange={event => {
            if (valid)
                onChange(day(date) + "T" + event.target.value + ":00");
        }}/>}{optional && value && <Button type="button" variant="ghost" size="icon" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange("")}><AdminIcon name="close"/></Button>}</div></div>;
}
