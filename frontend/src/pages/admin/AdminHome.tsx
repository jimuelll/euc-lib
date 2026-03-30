import { BookCopy, Users, ArrowLeftRight, CalendarDays } from "lucide-react";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";

const stats = [
  {
    label: "Total Books",
    value: "12,847",
    icon: BookCopy,
    helperText: "Current cataloged titles and copies available in the system.",
  },
  {
    label: "Active Users",
    value: "1,245",
    icon: Users,
    helperText: "Accounts with recent activity and borrowing access.",
  },
  {
    label: "Circulations Today",
    value: "87",
    icon: ArrowLeftRight,
    helperText: "Borrow and return transactions recorded for the day.",
  },
  {
    label: "Reservations",
    value: "34",
    icon: CalendarDays,
    helperText: "Open reservation requests waiting for action or pickup.",
  },
];

const AdminHome = () => (
  <AdminPage
    eyebrow="Library Management"
    title="Dashboard"
    description="A quick operational snapshot of library activity so staff can review key numbers before moving into tasks."
  >
    <AdminStatGrid>
      {stats.map((stat) => (
        <AdminStatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          helperText={stat.helperText}
          icon={<stat.icon className="h-4 w-4" />}
        />
      ))}
    </AdminStatGrid>

    <AdminPanel
      title="Start here"
      description="Use the left navigation to move between records, services, and reporting tools. The dashboard is kept intentionally simple so the next action is always clear."
    />
  </AdminPage>
);

export default AdminHome;
