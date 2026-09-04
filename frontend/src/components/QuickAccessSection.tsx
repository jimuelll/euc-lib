import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarCheck, FileText, Library, Monitor } from "lucide-react";

const quickLinks = [
  { title: "Search the Catalogue", description: "Explore books, journals, and more.", to: "/catalogue", icon: BookOpen },
  { title: "Room Reservation", description: "Plan ahead for study and research.", to: "/login", icon: CalendarCheck },
  { title: "Research Support", description: "Get help with your research needs.", to: "/services", icon: FileText },
  { title: "Library Services", description: "Access borrowing, renewal, and more.", to: "/services", icon: Library },
  { title: "Digital Resources", description: "Explore e-books and e-journals.", to: "/services/subscriptions", icon: Monitor },
];

const QuickAccessSection = () => (
  <section className="border-b border-border bg-background text-foreground">
    <div className="container px-5 py-8 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid gap-4 lg:grid-cols-[9.5rem_repeat(5,minmax(0,1fr))] lg:items-stretch lg:gap-3">
        <div className="pr-4 lg:py-2">
          <span className="mb-3 block h-px w-7 bg-warning" />
          <h2 className="text-2xl font-bold leading-none tracking-[-.045em]">Our Services</h2>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Support for every step of your academic journey.</p>
        </div>
        {quickLinks.map(({ title, description, to, icon: Icon }) => (
          <Link key={title} to={to} className="group flex min-h-[124px] flex-col border border-border bg-card px-4 py-4 transition-colors hover:border-primary hover:bg-primary">
            <Icon className="h-5 w-5 text-warning" />
            <h3 className="mt-3 text-[11px] font-bold leading-tight tracking-[-.02em] text-foreground transition-colors group-hover:text-primary-foreground">{title}</h3>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground transition-colors group-hover:text-primary-foreground/75">{description}</p>
            <ArrowRight className="mt-auto h-3.5 w-3.5 self-end text-warning transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export default QuickAccessSection;
