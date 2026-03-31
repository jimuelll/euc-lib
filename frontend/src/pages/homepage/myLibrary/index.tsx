import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Clock3,
  ExternalLink,
  GraduationCap,
  History,
  LibraryBig,
  Search,
  UserRound,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useMyLibrary } from "./hooks/useMyLibrary";
import { SectionHeader } from "./components/SectionHeader";
import type {
  ActiveBorrow,
  ActiveReservation,
  AttendanceSession,
  DashboardNotification,
  DashboardSubscription,
  ReservationHistoryItem,
} from "./types";

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay } },
});

const borrowStatusConfig: Record<ActiveBorrow["status"], { label: string; className: string }> = {
  borrowed: { label: "Borrowed", className: "bg-info/10 text-info border-info/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const reservationStatusConfig: Record<ActiveReservation["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-info/10 text-info border-info/20" },
  ready: { label: "Ready", className: "bg-success/10 text-success border-success/20" },
};

const historyStatusConfig: Record<ReservationHistoryItem["status"], { label: string; className: string }> = {
  fulfilled: { label: "Fulfilled", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-muted/50 text-muted-foreground border-border" },
  expired: { label: "Expired", className: "bg-warning/10 text-warning border-warning/20" },
};

const notificationStyles: Record<string, string> = {
  announcement: "bg-info/50",
  overdue_fine: "bg-destructive/60",
  reservation_ready: "bg-success/60",
  reservation_fulfilled: "bg-info/50",
  reservation_cancelled: "bg-warning/60",
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const formatDate = (value?: string | null, pattern = "MMM d, yyyy") => {
  if (!value) return "—";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, pattern) : "—";
};

const relativeTime = (value?: string | null) => {
  if (!value) return "Recently";
  const parsed = parseISO(value);
  return isValid(parsed) ? formatDistanceToNowStrict(parsed, { addSuffix: true }) : "Recently";
};

const dueLabel = (value: string) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Due date unavailable";
  const now = new Date();
  if (parsed < now) return `${formatDistanceToNowStrict(parsed)} overdue`;
  return `Due in ${formatDistanceToNowStrict(parsed)}`;
};

const formatCurrency = (value?: number | null) => currencyFormatter.format(Number(value || 0));

const SummaryCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) => (
  <div className="border border-border bg-card p-4">
    <p
      className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </p>
    <p
      className="mt-2 text-3xl font-bold text-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {value}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </div>
);

const EmptyPanel = ({ message }: { message: string }) => (
  <div className="px-5 py-8 text-center text-sm text-muted-foreground">{message}</div>
);

const MyLibrary = () => {
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useMyLibrary(!authLoading);
  const {
    notifications: liveNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const profile = data?.profile;
  const summary = data?.summary;
  const notifications = liveNotifications.length ? liveNotifications : (data?.notifications ?? []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="py-12">
        <div className="container max-w-6xl px-4 sm:px-6">
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
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1
                  className="text-2xl font-bold text-foreground sm:text-3xl"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                >
                  My Library
                </h1>
                <p className="mt-1 text-[12px] text-muted-foreground sm:text-sm">
                  Track your borrowing activity, reservations, attendance, and digital access in one place.
                </p>
              </div>

              <div className="border border-border bg-card px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{profile?.name ?? user?.name ?? "Library account"}</span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {profile?.student_employee_id ?? "Authenticated user"}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.08)}
            className="mt-6 flex flex-wrap gap-2"
          >
            {[
              { to: "/catalogue", icon: Search, label: "Browse Catalogue" },
              { to: "/services/borrowing", icon: CalendarDays, label: "Manage Reservations" },
              { to: "/services/subscriptions", icon: GraduationCap, label: "Digital Resources" },
              { to: "/edit-profile", icon: UserRound, label: "Edit Profile" },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to}>
                <button
                  className="flex h-8 items-center gap-2 border border-border bg-card px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:border-primary/40 hover:bg-muted/30"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {label}
                </button>
              </Link>
            ))}
          </motion.div>

          {error && (
            <div className="mt-6 border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.12)}
            className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            <SummaryCard
              label="Active Borrows"
              value={summary?.active_borrows ?? 0}
              hint={`${summary?.overdue_borrows ?? 0} overdue`}
            />
            <SummaryCard
              label="Due Soon"
              value={summary?.due_soon_borrows ?? 0}
              hint="Items due within 3 days"
            />
            <SummaryCard
              label="Outstanding Fines"
              value={formatCurrency(summary?.total_fines_due)}
              hint="Live overdue charges in your account"
            />
            <SummaryCard
              label="Reservations"
              value={summary?.active_reservations ?? 0}
              hint={`${summary?.ready_reservations ?? 0} ready for pickup`}
            />
            <SummaryCard
              label="Library Visits"
              value={summary?.attendance_logs ?? 0}
              hint="Recorded attendance scans"
            />
          </motion.div>

          {loading ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-64 animate-pulse border border-border bg-card/60" />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={BookOpen} label="Borrowed Books" count={data?.active_borrows.length ?? 0} />
                {data?.active_borrows.length ? (
                  <div className="divide-y divide-border">
                    {data.active_borrows.map((book) => (
                      <div key={book.id} className="flex gap-0">
                        <div className={`w-[3px] shrink-0 ${book.status === "overdue" ? "bg-destructive/60" : "bg-info/50"}`} />
                        <div className="flex-1 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className="truncate text-[13px] font-bold text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                {book.title}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                {book.author || "Unknown author"}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-[0.08em] ${borrowStatusConfig[book.status].className}`}
                              style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                            >
                              {borrowStatusConfig[book.status].label}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>Borrowed {formatDate(book.borrowed_at, "MMM d, yyyy h:mm a")}</span>
                            <span>Due {formatDate(book.due_date, "MMM d, yyyy h:mm a")}</span>
                            <span>{dueLabel(book.due_date)}</span>
                            {book.status === "overdue" ? (
                              <span className="font-medium text-destructive">
                                Fine {formatCurrency(book.fine_amount)}
                              </span>
                            ) : null}
                            {book.location && <span>{book.location}</span>}
                            {book.copy_barcode && <span>{book.copy_barcode}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel message="No active borrowed books right now." />
                )}
              </motion.section>

              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0.05)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={CalendarDays} label="Reservations" count={data?.active_reservations.length ?? 0} />
                {data?.active_reservations.length ? (
                  <div className="divide-y divide-border">
                    {data.active_reservations.map((reservation) => (
                      <div key={reservation.id} className="flex gap-0">
                        <div className={`w-[3px] shrink-0 ${reservation.status === "ready" ? "bg-success/60" : "bg-info/50"}`} />
                        <div className="flex-1 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className="truncate text-[13px] font-bold text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                {reservation.title}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                                {reservation.author || "Unknown author"}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-[0.08em] ${reservationStatusConfig[reservation.status].className}`}
                              style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                            >
                              {reservationStatusConfig[reservation.status].label}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>Reserved {formatDate(reservation.reserved_at)}</span>
                            {reservation.expires_at && <span>Pickup by {formatDate(reservation.expires_at, "MMM d, yyyy h:mm a")}</span>}
                            {reservation.location && <span>{reservation.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel message="No active reservations at the moment." />
                )}
              </motion.section>

              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0.06)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={Clock3} label="Attendance History" count={data?.attendance_sessions.length ?? 0} />
                {data?.attendance_sessions.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          {["Date", "Time In", "Time Out"].map((heading) => (
                            <th
                              key={heading}
                              className="px-5 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
                              style={{ fontFamily: "var(--font-heading)" }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.attendance_sessions.map((session, index) => (
                          <AttendanceRow key={`${session.date ?? "attendance"}-${index}`} session={session} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyPanel message="No attendance logs found yet." />
                )}
              </motion.section>

              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0.08)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={Bell} label="Notifications" count={notifications.length} />
                {notifications.length ? (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <Link
                        key={notification.id}
                        to={notification.href || "/my-library"}
                        className="block"
                        onClick={() => {
                          if (!notification.is_read) {
                            void markAsRead(notification.id);
                          }
                        }}
                      >
                        <div className={`flex gap-0 transition-colors hover:bg-muted/10 ${notification.is_read ? "opacity-75" : ""}`}>
                          <div className={`w-[3px] shrink-0 ${notificationStyles[notification.type] ?? "bg-info/50"}`} />
                          <div className="flex-1 px-4 py-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <p
                                className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                {notification.title}
                              </p>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                {relativeTime(notification.created_at)}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                              {notification.body}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel message="No urgent updates right now." />
                )}
                {notifications.length > 0 && unreadCount > 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <button
                      onClick={() => void markAllAsRead()}
                      className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </motion.section>

              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0.1)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={History} label="Recent Activity" count={(data?.borrow_history.length ?? 0) + (data?.reservation_history.length ?? 0)} />
                <div className="divide-y divide-border">
                  {data?.borrow_history.map((item) => (
                    <HistoryItem
                      key={`borrow-${item.id}`}
                      title={item.title}
                      subtitle={item.author || "Unknown author"}
                      meta={`Returned ${formatDate(item.returned_at)}`}
                      badgeLabel="Borrowing"
                    />
                  ))}
                  {data?.reservation_history.map((item) => (
                    <HistoryItem
                      key={`reservation-${item.id}`}
                      title={item.title}
                      subtitle={item.author || "Unknown author"}
                      meta={`${historyStatusConfig[item.status].label} • ${formatDate(item.reserved_at)}`}
                      badgeLabel="Reservation"
                    />
                  ))}
                  {!data?.borrow_history.length && !data?.reservation_history.length && (
                    <EmptyPanel message="Your recent borrowing and reservation history will appear here." />
                  )}
                </div>
              </motion.section>

              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp(0.12)}
                className="border border-border bg-card overflow-hidden"
              >
                <SectionHeader icon={LibraryBig} label="Digital Resources" count={data?.subscriptions.length ?? 0} />
                {data?.subscriptions.length ? (
                  <div className="divide-y divide-border">
                    {data.subscriptions.map((subscription) => (
                      <SubscriptionItem key={subscription.id} subscription={subscription} />
                    ))}
                  </div>
                ) : (
                  <EmptyPanel message="No academic subscriptions are available yet." />
                )}
              </motion.section>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

const AttendanceRow = ({ session }: { session: AttendanceSession }) => (
  <tr className="transition-colors hover:bg-muted/10">
    <td
      className="px-5 py-3 text-[12px] font-bold text-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {formatDate(session.date)}
    </td>
    <td
      className="px-5 py-3 text-[12px] text-success"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {formatDate(session.time_in, "h:mm a")}
    </td>
    <td className="px-5 py-3 text-[12px] text-muted-foreground">
      {formatDate(session.time_out, "h:mm a")}
    </td>
  </tr>
);

const HistoryItem = ({
  title,
  subtitle,
  meta,
  badgeLabel,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badgeLabel: string;
}) => (
  <div className="flex items-start justify-between gap-3 px-4 py-3.5">
    <div className="min-w-0">
      <p
        className="truncate text-[13px] font-bold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{meta}</p>
    </div>
    <Badge
      variant="outline"
      className="text-[10px] font-bold uppercase tracking-[0.08em]"
      style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
    >
      {badgeLabel}
    </Badge>
  </div>
);

const SubscriptionItem = ({ subscription }: { subscription: DashboardSubscription }) => (
  <a
    href={subscription.url}
    target="_blank"
    rel="noreferrer"
    className="flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/10"
  >
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden border border-border bg-muted shrink-0">
      {subscription.image_url ? (
        <img src={subscription.image_url} alt={subscription.title} className="h-full w-full object-cover" />
      ) : (
        <GraduationCap className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <p
          className="truncate text-[13px] font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {subscription.title}
        </p>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {subscription.description || "Academic resource for online research and study."}
      </p>
      {subscription.category && (
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {subscription.category}
        </p>
      )}
    </div>
  </a>
);

export default MyLibrary;
