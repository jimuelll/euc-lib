import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  BookOpen, CalendarDays, Clock, Bell,
  Search, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const borrowedBooks = [
  {
    id: 1,
    title: "Introduction to Algorithms",
    author: "Thomas H. Cormen",
    cover: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=80&h=120&fit=crop",
    borrowDate: "Feb 25, 2026",
    dueDate: "Mar 11, 2026",
    status: "on-time" as const,
  },
  {
    id: 2,
    title: "Database System Concepts",
    author: "Abraham Silberschatz",
    cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=80&h=120&fit=crop",
    borrowDate: "Feb 20, 2026",
    dueDate: "Mar 6, 2026",
    status: "overdue" as const,
  },
  {
    id: 3,
    title: "Clean Code",
    author: "Robert C. Martin",
    cover: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=80&h=120&fit=crop",
    borrowDate: "Mar 5, 2026",
    dueDate: "Mar 19, 2026",
    status: "due-soon" as const,
  },
];

const reservations = [
  { id: 1, title: "Data Structures in Java",    reservedDate: "Mar 9, 2026",  pickupDeadline: "Mar 11, 2026", status: "active"  as const },
  { id: 2, title: "Operating System Concepts",  reservedDate: "Mar 8, 2026",  pickupDeadline: "Mar 10, 2026", status: "expired" as const },
];

const attendanceHistory = [
  { date: "Mar 13, 2026", timeIn: "8:15 AM",  timeOut: "12:30 PM" },
  { date: "Mar 12, 2026", timeIn: "9:00 AM",  timeOut: "3:45 PM"  },
  { date: "Mar 11, 2026", timeIn: "7:45 AM",  timeOut: "11:00 AM" },
  { date: "Mar 10, 2026", timeIn: "1:00 PM",  timeOut: "5:30 PM"  },
];

const notifications = [
  { id: 1, text: "Your reservation for 'Data Structures in Java' is ready for pickup.",       time: "2 hours ago", type: "info"    as const },
  { id: 2, text: "'Database System Concepts' is overdue. Please return it to avoid penalties.", time: "1 day ago",   type: "warning" as const },
  { id: 3, text: "Library will be closed March 20–28 for spring break.",                       time: "3 days ago",  type: "info"    as const },
];

const borrowStatusConfig = {
  "on-time": { label: "On Time", className: "bg-success/10 text-success border-success/20"       },
  "due-soon": { label: "Due Soon", className: "bg-warning/10 text-warning border-warning/20"     },
  overdue:    { label: "Overdue",  className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const resStatusConfig = {
  active:  { label: "Active",  className: "bg-info/10 text-info border-info/20"                   },
  expired: { label: "Expired", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

/* ── Shared section header ──────────────────────────────────────────────── */
const SectionHeader = ({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
}) => (
  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
    <div className="flex items-center gap-3">
      <div className="h-4 w-[2px] bg-warning shrink-0" />
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </div>
    {count !== undefined && (
      <span
        className="inline-flex items-center justify-center border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {count}
      </span>
    )}
  </div>
);

/* ── Fade-in variant ────────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay } },
});

const StudentDashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="py-12">
        <div className="container max-w-6xl px-4 sm:px-6">

          {/* ── Page header ───────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-px w-4 bg-warning shrink-0" />
              <span
                className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Enverga-Candelaria Library
              </span>
            </div>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
            >
              My Library
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Manage your library activity and account.
            </p>
          </motion.div>

          {/* ── Quick actions ─────────────────────────────────────────────── */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.08)}
            className="mt-6 flex flex-wrap gap-2"
          >
            {[
              { to: "/catalogue",           icon: Search,       label: "Browse Catalogue" },
              { to: "/services/reservation", icon: CalendarDays, label: "Reserve Book"     },
              { to: "/services/borrowing",   icon: BookOpen,     label: "Borrowing History" },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to}>
                <button
                  className="h-8 px-4 flex items-center gap-2 border border-border bg-card text-[10px] font-bold uppercase tracking-[0.15em] text-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {label}
                </button>
              </Link>
            ))}
          </motion.div>

          {/* ── Panels grid ───────────────────────────────────────────────── */}
          <div className="mt-8 grid gap-5 lg:grid-cols-2">

            {/* Borrowed Books */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp(0)}
              className="border border-border bg-card overflow-hidden"
            >
              <SectionHeader icon={BookOpen} label="Borrowed Books" count={borrowedBooks.length} />

              <div className="divide-y divide-border">
                {borrowedBooks.map((book) => (
                  <div key={book.id} className="flex items-center gap-0 group">
                    {/* Status-colored left bar */}
                    <div
                      className={`w-[3px] self-stretch shrink-0 ${
                        book.status === "overdue"
                          ? "bg-destructive/60"
                          : book.status === "due-soon"
                          ? "bg-warning/60"
                          : "bg-success/40"
                      }`}
                    />

                    {/* Cover thumbnail */}
                    <div className="shrink-0 w-10 h-16 overflow-hidden bg-muted border-r border-border">
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="h-full w-full object-cover opacity-90"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 px-4 py-3">
                      <p
                        className="text-[13px] font-bold text-foreground truncate leading-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {book.title}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 truncate"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {book.author}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/60">
                        <span>Borrowed {book.borrowDate}</span>
                        <span>Due {book.dueDate}</span>
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="px-3 shrink-0 border-l border-border/60 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap ${borrowStatusConfig[book.status].className}`}
                        style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                      >
                        {borrowStatusConfig[book.status].label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Reservations */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp(0.05)}
              className="border border-border bg-card overflow-hidden"
            >
              <SectionHeader icon={CalendarDays} label="Reservations" count={reservations.length} />

              <div className="divide-y divide-border">
                {reservations.map((res) => (
                  <div key={res.id} className="flex items-center gap-0">
                    <div
                      className={`w-[3px] self-stretch shrink-0 ${
                        res.status === "expired" ? "bg-destructive/50" : "bg-info/50"
                      }`}
                    />
                    <div className="flex-1 min-w-0 px-4 py-3.5">
                      <p
                        className="text-[13px] font-bold text-foreground truncate"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {res.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/60">
                        <span>Reserved {res.reservedDate}</span>
                        <span>Pickup by {res.pickupDeadline}</span>
                      </div>
                    </div>
                    <div className="px-3 shrink-0 border-l border-border/60 py-3.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase tracking-[0.08em] ${resStatusConfig[res.status].className}`}
                        style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                      >
                        {resStatusConfig[res.status].label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Attendance History */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp(0.05)}
              className="border border-border bg-card overflow-hidden"
            >
              <SectionHeader icon={Clock} label="Attendance History" />

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Date", "Time In", "Time Out"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attendanceHistory.map((a, i) => (
                      <tr key={i} className="group hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3 text-[12px] font-bold text-foreground"
                          style={{ fontFamily: "var(--font-heading)" }}>
                          {a.date}
                        </td>
                        <td className="px-5 py-3 text-[12px] font-bold text-success"
                          style={{ fontFamily: "var(--font-heading)" }}>
                          {a.timeIn}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground">
                          {a.timeOut}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp(0.08)}
              className="border border-border bg-card overflow-hidden"
            >
              <SectionHeader icon={Bell} label="Notifications" count={notifications.length} />

              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-0">
                    {/* Type accent bar */}
                    <div
                      className={`w-[3px] self-stretch shrink-0 ${
                        n.type === "warning" ? "bg-warning/60" : "bg-info/40"
                      }`}
                    />
                    <div className="flex items-start gap-3 px-4 py-3.5 flex-1 min-w-0">
                      {n.type === "warning" ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                      ) : (
                        <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5 text-info/60" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-foreground leading-relaxed">{n.text}</p>
                        <p
                          className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {n.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StudentDashboard;