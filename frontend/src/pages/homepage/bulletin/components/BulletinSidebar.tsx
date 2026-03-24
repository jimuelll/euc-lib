import { Calendar } from "lucide-react";
import type { UpcomingEvent } from "../types";

const upcomingEvents: UpcomingEvent[] = [
  { title: "Research Writing Workshop", date: "March 25, 2026", time: "2:00 PM – 4:00 PM" },
  { title: "Book Fair 2026",            date: "April 5–7, 2026",  time: "9:00 AM – 5:00 PM" },
  { title: "Digital Literacy Seminar",  date: "April 15, 2026",   time: "10:00 AM – 12:00 PM" },
  { title: "Author Meet & Greet",       date: "April 22, 2026",   time: "3:00 PM – 5:00 PM" },
];

export function BulletinSidebar() {
  return (
    <aside className="w-full lg:w-72 lg:shrink-0">
      <div className="rounded-2xl border border-border/60 bg-card p-5 lg:sticky lg:top-20">
        <h2 className="flex items-center gap-2 font-bold text-base text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </span>
          Upcoming Events
        </h2>
        <div className="mt-4 space-y-3.5">
          {upcomingEvents.map((event) => (
            <div key={event.title} className="flex gap-3 group">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
              <div>
                <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.date}</p>
                <p className="text-xs text-muted-foreground">{event.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}