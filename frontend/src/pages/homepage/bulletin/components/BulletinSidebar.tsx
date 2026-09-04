import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UpcomingEvent } from "../types";

const upcomingEvents: UpcomingEvent[] = [
  { title: "Research Writing Workshop", date: "March 25, 2026", time: "2:00 PM – 4:00 PM" },
  { title: "Book Fair 2026",            date: "April 5–7, 2026",  time: "9:00 AM – 5:00 PM" },
  { title: "Digital Literacy Seminar",  date: "April 15, 2026",   time: "10:00 AM – 12:00 PM" },
  { title: "Author Meet & Greet",       date: "April 22, 2026",   time: "3:00 PM – 5:00 PM" },
];

// ── Sidebar section heading — ruled label ────────────────────────────────────
const SidebarHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-4">
    <span
      className="text-[9px] font-bold uppercase tracking-[0.28em] text-warning shrink-0"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export function BulletinSidebar() {
  const { user } = useAuth();
  const canManage = ["admin", "super_admin"].includes(user?.role ?? "");
  const [events, setEvents] = useState<UpcomingEvent[]>(upcomingEvents);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const load = async () => {
    try {
      const { data } = await axiosInstance.get("/api/events");
      setEvents(data.map((event: { id: number; title: string; starts_at: string; ends_at?: string }) => {
        const start = new Date(event.starts_at);
        const end = event.ends_at ? new Date(event.ends_at) : null;
        return {
          id: event.id,
          title: event.title,
          date: start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          time: `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${end ? ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`,
        };
      }));
    } catch {
      // Keep the supplied fallback events when the endpoint is unavailable.
    }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => { if (!title.trim() || !startsAt) return; await axiosInstance.post("/api/events", { title, starts_at: startsAt }); setTitle(""); setStartsAt(""); setOpen(false); await load(); };
  return (
    <aside className="w-full self-start lg:sticky lg:top-[4.5rem] lg:w-72 lg:shrink-0">

      {/* ── Upcoming Events ── */}
      <div className="border border-border">

        {/* Section header — same primary-band grammar as page header, compressed */}
        <div className="bg-primary px-4 py-3 flex items-center gap-3 border-b border-primary-foreground/10">
          <div className="h-px w-4 bg-warning shrink-0" />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Upcoming Events
          </span>
          {canManage ? <button onClick={() => setOpen(true)} className="ml-auto text-[9px] font-bold uppercase tracking-[0.14em] text-primary-foreground/70 hover:text-warning">Update</button> : null}
        </div>

        {/* Event list — flush rows separated by ruled lines */}
        <div className="divide-y divide-border">
          {events.map((event, i) => (
            <div
              key={event.title}
              className="group flex gap-0 transition-colors duration-200 hover:bg-secondary/50"
            >
              {/* Index column — like a numbered register */}
              <div
                className="w-8 shrink-0 flex items-start justify-center pt-4 border-r border-border"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <span className="text-[9px] font-bold text-warning/60 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 px-3.5 py-3.5">
                <p
                  className="text-[12px] font-bold leading-snug text-foreground group-hover:text-primary transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {event.title}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                  {event.date}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground/80">
                  {event.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer rule */}
        <div className="h-[3px] w-full bg-warning" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Update upcoming events</DialogTitle></DialogHeader><div className="space-y-3"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="h-10 w-full border border-border bg-background px-3 text-sm" /><input value={startsAt} onChange={(e) => setStartsAt(e.target.value)} type="datetime-local" className="h-10 w-full border border-border bg-background px-3 text-sm" /><button onClick={() => void save()} className="w-full bg-primary py-2 text-xs font-bold uppercase text-primary-foreground">Add event</button></div></DialogContent></Dialog>

    </aside>
  );
}
