import { BookCopy, Users, ArrowLeftRight, CalendarDays } from "lucide-react";

const stats = [
  { label: "Total Books", value: "12,847", icon: BookCopy },
  { label: "Active Users", value: "1,245", icon: Users },
  { label: "Circulations Today", value: "87", icon: ArrowLeftRight },
  { label: "Reservations", value: "34", icon: CalendarDays },
];

const AdminHome = () => (
  <div>
    <h2 className="font-heading text-lg font-bold text-foreground">Dashboard</h2>
    <p className="mt-1 text-sm text-muted-foreground">Welcome back, Admin.</p>

    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 font-heading text-2xl font-bold text-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  </div>
);

export default AdminHome;
