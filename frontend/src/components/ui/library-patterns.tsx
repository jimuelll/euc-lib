import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LibraryShelf({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("library-shelf", className)} {...props} />;
}

export function LibraryLedger({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("library-ledger", className)} {...props} />;
}

export function LibrarySlip({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("library-slip", className)} {...props} />;
}

/** A bounded set of spines; the adjacent numeric label remains authoritative. */
export function LibraryAvailability({ available, total, children }: { available: number; total?: number; children?: ReactNode }) {
  const knownTotal = total !== undefined && Number.isFinite(total);
  const safeAvailable = Math.max(0, Math.trunc(Number.isFinite(available) ? available : 0));
  const safeTotal = knownTotal ? Math.max(0, Math.trunc(total)) : safeAvailable;
  const onShelf = knownTotal ? Math.min(safeTotal, safeAvailable) : safeAvailable;
  return <span className="library-availability">
    <span className="library-availability-pips" aria-hidden="true">{Array.from({ length: Math.min(safeTotal, 8) || 1 }, (_, i) => <i key={i} data-available={i < onShelf} />)}</span>
    {children || <span>{knownTotal ? `${onShelf} of ${safeTotal} available` : `${onShelf} ${onShelf === 1 ? "copy" : "copies"} available`}</span>}
  </span>;
}

/** Never supplies illustrative data or treats an absent series as a recorded zero. */
export function LibrarySpineChart({ values, label }: { values: number[]; label: string }) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) return null;
  const max = Math.max(...values, 1);
  return <span className="library-spines" role="img" aria-label={`${label}: ${values.join(", ")}`}>
    {values.map((value, index) => <i key={index} style={{ height: `${Math.max(3, value / max * 32)}px` }} />)}
  </span>;
}

export function LibraryTermTimeline({ start, end, today }: { start: string; end: string; today: string }) {
  const startTime = Date.parse(start.slice(0, 10));
  const endTime = Date.parse(end.slice(0, 10));
  const now = Date.parse(today);
  if (![startTime, endTime, now].every(Number.isFinite) || endTime < startTime) return null;
  const progress = endTime === startTime ? Number(now >= startTime) * 100
    : Math.round(Math.min(1, Math.max(0, (now - startTime) / (endTime - startTime))) * 100);
  const label = now < startTime ? "Not started" : now > endTime ? "Term ended" : `${progress}% elapsed`;
  const dateLabel = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
  return <div className="library-term-timeline">
    <div role="img" aria-label={`Academic term: ${label}`} className="library-term-track"><span style={{ width: `${progress}%` }} /><i style={{ left: `${progress}%` }} /></div>
    <div className="library-term-dates"><time dateTime={start.slice(0, 10)}>{dateLabel(new Date(startTime).toISOString())}</time><time dateTime={today}>Today · {dateLabel(new Date(now).toISOString())}</time><time dateTime={end.slice(0, 10)}>{dateLabel(new Date(endTime).toISOString())}</time></div><span>{label}</span>
  </div>;
}
