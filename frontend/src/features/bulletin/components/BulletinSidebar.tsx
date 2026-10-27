import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDateTime } from "@/features/admin";
import type { UpcomingEvent } from "../types";
import { createEvent, fetchEvents, type SiteEvent } from "@/features/site-content";
import {PublicationNotificationOption} from "@/features/notifications/PublicationNotificationOption";
import {usePublicationNotice} from "@/features/notifications/usePublicationNotice";
import { siteContentKeys } from "@/features/site-content";

export function BulletinSidebar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = ["admin", "super_admin"].includes(user?.role ?? "");
  const eventsQuery = useQuery({ queryKey: siteContentKeys.eventList(false), queryFn: ({ signal }) => fetchEvents(false, signal) });
  const createMutation = useMutation({ mutationFn: createEvent, onSuccess: () => queryClient.invalidateQueries({ queryKey: siteContentKeys.events() }) });
  const events: UpcomingEvent[] = eventsQuery.data ? [...eventsQuery.data].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).map((event: SiteEvent) => {
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : null;
    const sameMonth = end && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    return {
      id: event.id,
      title: event.title,
      dateDay: `${start.getDate()}${sameMonth && start.getDate() !== end.getDate() ? `–${end.getDate()}` : ""}`,
      dateMonth: `${start.toLocaleDateString("en-US", { month: "short" })}${end && !sameMonth ? `–${end.toLocaleDateString("en-US", { month: "short" })}` : ""}`,
      date: `${start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${end && start.toDateString() !== end.toDateString() ? ` – ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}`,
    };
  }) : [];
  const notice=usePublicationNotice();
  const [showAll, setShowAll] = useState(false);
  const [nextEvent, ...remainingEvents] = events;
  const visibleEvents = showAll ? remainingEvents : remainingEvents.slice(0, 3);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saveError, setSaveError] = useState("");
  const saveLock=useRef(false);
  const save = async () => {
    if (!title.trim() || !startsAt || createMutation.isPending || saveLock.current) return;
    if (endsAt && endsAt < startsAt) { setSaveError("End date must be on or after the start date."); return; }
    setSaveError("");saveLock.current=true;
    try {
      const notifyUsers=await notice.prepare();if(notifyUsers===null)return;
      await createMutation.mutateAsync({
        title: title.trim(),
        starts_at: new Date(`${startsAt}T00:00:00`).toISOString(),
        ends_at: new Date(`${endsAt || startsAt}T23:59:59`).toISOString(),
        notifyUsers,
      });
      setTitle(""); setStartsAt(""); setEndsAt(""); notice.reset(); setOpen(false);
    } catch (error:any) { setSaveError(error.response?.data?.message||error.message||"The event could not be added. Please try again."); } finally {saveLock.current=false;}
  };
  return (
    <aside id="upcoming-events" className="bulletin-agenda" aria-labelledby="bulletin-agenda-heading">
      <div className="bulletin-agenda-heading"><h2 id="bulletin-agenda-heading">Coming up</h2><span>{events.length} event{events.length === 1 ? "" : "s"}</span></div>
      {eventsQuery.isPending && <p role="status" className="bulletin-agenda-status">Loading upcoming events…</p>}
      {eventsQuery.isError && <div role="alert" className="bulletin-agenda-status"><p>Upcoming events could not be loaded.</p><button className="bulletin-text-button" onClick={() => void eventsQuery.refetch()}>Try again</button></div>}
      {!eventsQuery.isPending && !eventsQuery.isError && !events.length && <p className="bulletin-agenda-status">No upcoming events.</p>}
      {nextEvent && <div className="bulletin-next-event">
        <div className="bulletin-next-date" aria-hidden="true">{nextEvent.dateDay}<small>{nextEvent.dateMonth}</small></div>
        <div className="bulletin-next-copy"><span>Next</span><b>{nextEvent.title}</b><p>{nextEvent.date}</p></div>
      </div>}
      {visibleEvents.map((event) => <div key={event.id ?? `${event.title}-${event.date}`} className="bulletin-event-row">
        <div className="bulletin-event-date" aria-hidden="true">{event.dateDay}<small>{event.dateMonth}</small></div>
        <div><b>{event.title}</b><span>{event.date}</span></div>
      </div>)}
      {(events.length > 4 || canManage) && <div className="bulletin-agenda-actions">
        {events.length > 4 && <button className="bulletin-text-button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>{showAll ? "Show fewer" : `Show all ${events.length} events`}</button>}
        {canManage && <button className="bulletin-text-button" onClick={() => setOpen(true)}>Update</button>}
      </div>}
      <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)notice.reset();}}>
        <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Update upcoming events</DialogTitle></DialogHeader>
          <form className="bulletin-event-form space-y-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <label className="block text-sm font-medium" htmlFor="bulletin-event-title">Event title</label>
            <input id="bulletin-event-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" required className="h-10 w-full border border-border bg-background px-3 text-sm" />
            <AdminDateTime label="Start date" value={startsAt} onChange={setStartsAt} dateOnly />
            <AdminDateTime label="End date (optional)" value={endsAt} onChange={setEndsAt} dateOnly optional />
            <p className="text-xs text-muted-foreground">Leave the end blank for a single-date event.</p>
            <PublicationNotificationOption checked={notice.checked} onChange={notice.setChecked} preview={notice.preview.data} loading={notice.preview.isPending} error={notice.preview.isError} onRetry={()=>void notice.preview.refetch()}/>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <button type="submit" disabled={!title.trim() || !startsAt || createMutation.isPending} className="w-full bg-primary py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50">{createMutation.isPending ? "Adding event…" : "Add event"}</button>
          </form>
        </DialogContent>
      </Dialog>{notice.confirmDialog}

    </aside>
  );
}
