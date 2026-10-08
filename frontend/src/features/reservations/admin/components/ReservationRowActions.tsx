import { Button } from "@/components/ui/button";
import { AdminIcon, AdminRowMenu } from "@/features/admin";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReservationStatus } from "../reservations.types";

interface Props {
  id: number; title: string; status: ReservationStatus; isActing: boolean; showArchived: boolean;
  preparationBlocker?: string;
  onMarkReady: (id: number, title: string) => void; onFulfill: (id: number, title: string) => void;
  onCancel: (id: number, title: string) => void; onArchive: (id: number, title: string) => void;
  onRestore: (id: number, title: string) => void; onDetails?: () => void;
}
export default function ReservationRowActions(p: Props) {
  const live = p.status === "pending" || p.status === "ready";
  const primary = <Button className="admin-compact-button" disabled={p.isActing || !!p.preparationBlocker} onClick={() => p.status === "pending" ? p.onMarkReady(p.id, p.title) : p.onFulfill(p.id, p.title)}><AdminIcon name={p.isActing ? "refresh" : p.status === "ready" ? "borrow" : "reservations"} className={p.isActing ? "animate-spin" : ""} />{p.status === "pending" ? "Mark ready" : "Process pickup"}</Button>;
  return <div className="reservation-actions" onClick={event => event.stopPropagation()}>
    {!p.showArchived && live && (p.preparationBlocker ? <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="reservation-primary-action" tabIndex={0} aria-label={p.preparationBlocker}>{primary}</span></TooltipTrigger><TooltipContent className="max-w-xs">{p.preparationBlocker}</TooltipContent></Tooltip></TooltipProvider> : primary)}
    {p.showArchived && <Button variant="outline" className="admin-compact-button" disabled={p.isActing} onClick={() => p.onRestore(p.id, p.title)}>Restore</Button>}
    <AdminRowMenu label={`Actions for ${p.title}, ${p.id}`} disabled={p.isActing} items={[
      ...(p.onDetails ? [{ label: "View details", onSelect: p.onDetails }] : []),
      ...(!p.showArchived && live ? [{ label: "Cancel reservation\u2026", destructive: true, onSelect: () => p.onCancel(p.id, p.title) }] : []),
      ...(!p.showArchived && !live ? [{ label: "Archive reservation\u2026", onSelect: () => p.onArchive(p.id, p.title) }] : []),
      ...(p.showArchived ? [{ label: "Restore reservation\u2026", onSelect: () => p.onRestore(p.id, p.title) }] : []),
    ]} />
  </div>;
}
