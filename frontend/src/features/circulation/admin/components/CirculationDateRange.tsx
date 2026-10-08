import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AdminIcon } from "@/features/admin";
import type { DateRange } from "react-day-picker";
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const display = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
export default function CirculationDateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string | null, to: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const preset = (kind: string) => { const end = new Date(); const start = new Date(end); if (kind === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7); if (kind === "month") start.setDate(1); onChange(localDate(start), localDate(end)); setOpen(false); };
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) setDraft(from ? { from: new Date(from + "T12:00:00"), to: to ? new Date(to + "T12:00:00") : undefined } : undefined); }}><PopoverTrigger asChild><Button variant="outline"><AdminIcon name="reservations" />{from ? `${display(from)}${to && to !== from ? ` – ${display(to)}` : ""}` : "Borrowed date"}</Button></PopoverTrigger><PopoverContent align="end" className="circulation-date-popover w-auto p-3"><p className="text-sm font-medium mb-2">Borrowed date range</p><div className="flex gap-2 flex-wrap">{[["today", "Today"], ["week", "This week"], ["month", "This month"]].map(([kind, label]) => <Button key={kind} variant="outline" size="sm" onClick={() => preset(kind)}>{label}</Button>)}</div><Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={1} /><div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => { onChange(null, null); setOpen(false); }}>All dates</Button><Button disabled={!draft?.from} onClick={() => { if (draft?.from) onChange(localDate(draft.from), localDate(draft.to || draft.from)); setOpen(false); }}>Apply range</Button></div></PopoverContent></Popover>;
}
