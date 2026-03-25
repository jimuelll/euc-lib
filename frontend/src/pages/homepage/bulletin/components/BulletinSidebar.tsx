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
  return (
    <aside className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-[4.5rem] self-start">

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
        </div>

        {/* Event list — flush rows separated by ruled lines */}
        <div className="divide-y divide-border">
          {upcomingEvents.map((event, i) => (
            <div
              key={event.title}
              className="flex gap-0 group hover:bg-secondary/50 transition-colors duration-100"
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
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">
                  {event.date}
                </p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">
                  {event.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer rule */}
        <div className="h-[3px] w-full bg-warning" />
      </div>

    </aside>
  );
}