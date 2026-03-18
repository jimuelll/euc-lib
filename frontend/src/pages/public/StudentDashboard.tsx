import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen, CalendarDays, Clock, Bell, Search, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { id: 1, title: "Data Structures in Java", reservedDate: "Mar 9, 2026", pickupDeadline: "Mar 11, 2026", status: "active" as const },
  { id: 2, title: "Operating System Concepts", reservedDate: "Mar 8, 2026", pickupDeadline: "Mar 10, 2026", status: "expired" as const },
];

const attendanceHistory = [
  { date: "Mar 13, 2026", timeIn: "8:15 AM", timeOut: "12:30 PM" },
  { date: "Mar 12, 2026", timeIn: "9:00 AM", timeOut: "3:45 PM" },
  { date: "Mar 11, 2026", timeIn: "7:45 AM", timeOut: "11:00 AM" },
  { date: "Mar 10, 2026", timeIn: "1:00 PM", timeOut: "5:30 PM" },
];

const notifications = [
  { id: 1, text: "Your reservation for 'Data Structures in Java' is ready for pickup.", time: "2 hours ago", type: "info" as const },
  { id: 2, text: "'Database System Concepts' is overdue. Please return it to avoid penalties.", time: "1 day ago", type: "warning" as const },
  { id: 3, text: "Library will be closed March 20–28 for spring break.", time: "3 days ago", type: "info" as const },
];

const borrowStatusConfig = {
  "on-time": { label: "On Time", className: "bg-success/10 text-success border-success/20" },
  "due-soon": { label: "Due Soon", className: "bg-warning/10 text-warning border-warning/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const resStatusConfig = {
  active: { label: "Active", className: "bg-info/10 text-info border-info/20" },
  expired: { label: "Expired", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const StudentDashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-12">
        <div className="container max-w-6xl">
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <h1 className="font-heading text-2xl font-bold text-foreground">My Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your library activity.</p>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ ...fadeIn, visible: { ...fadeIn.visible, transition: { delay: 0.1, duration: 0.5 } } }}
            className="mt-6 flex flex-wrap gap-2"
          >
            <Link to="/catalogue">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Search className="h-3.5 w-3.5" /> Browse Catalogue
              </Button>
            </Link>
            <Link to="/services/reservation">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Reserve Book
              </Button>
            </Link>
            <Link to="/services/borrowing">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Borrowing History
              </Button>
            </Link>
          </motion.div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Borrowed Books */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-lg border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Borrowed Books
                </h2>
                <Badge variant="secondary" className="text-xs">{borrowedBooks.length}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {borrowedBooks.map((book) => (
                  <div key={book.id} className="flex items-center gap-3 rounded-md border p-3">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="h-16 w-11 shrink-0 rounded object-cover bg-muted"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Borrowed: {book.borrowDate}</span>
                        <span>Due: {book.dueDate}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={borrowStatusConfig[book.status].className}>
                      {borrowStatusConfig[book.status].label}
                    </Badge>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Reservations */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-lg border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" /> Reservations
                </h2>
                <Badge variant="secondary" className="text-xs">{reservations.length}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {reservations.map((res) => (
                  <div key={res.id} className="flex items-center gap-3 rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{res.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Reserved: {res.reservedDate}</span>
                        <span>Pickup by: {res.pickupDeadline}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={resStatusConfig[res.status].className}>
                      {resStatusConfig[res.status].label}
                    </Badge>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Attendance History */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="rounded-lg border bg-card p-5"
            >
              <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Attendance History
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Time In</th>
                      <th className="pb-2 font-medium">Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((a, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2.5 text-foreground">{a.date}</td>
                        <td className="py-2.5 text-success">{a.timeIn}</td>
                        <td className="py-2.5 text-muted-foreground">{a.timeOut}</td>
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
              variants={fadeIn}
              className="rounded-lg border bg-card p-5"
            >
              <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notifications
              </h2>
              <div className="mt-4 space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-md border p-3 ${
                      n.type === "warning" ? "border-warning/30 bg-warning/5" : ""
                    }`}
                  >
                    {n.type === "warning" ? (
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                    ) : (
                      <Bell className="h-4 w-4 shrink-0 mt-0.5 text-info" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{n.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
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
