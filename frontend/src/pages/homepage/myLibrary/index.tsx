import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  LibraryBig,
  Search,
  UserRound,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useMyLibrary } from "./hooks/useMyLibrary";
import type {
  ActiveBorrow,
  ActiveReservation,
  AttendanceSession,
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

const historyStatusConfig: Record<ReservationHistoryItem["status"], { label: string }> = {
  fulfilled: { label: "Fulfilled" },
  cancelled: { label: "Cancelled" },
  expired: { label: "Expired" },
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
  if (!value) return "-";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, pattern) : "-";
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

const quickLinks = [
  { to: "/catalogue", icon: Search, label: "Browse Catalogue" },
  { to: "/services/borrowing", icon: CalendarDays, label: "Reservations" },
  { to: "/services/subscriptions", icon: GraduationCap, label: "Digital Resources" },
  { to: "/edit-profile", icon: UserRound, label: "Edit Profile" },
];

const Surface = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="overflow-hidden border border-border/80 bg-card/95">
    <div className="h-[2px] w-full bg-[linear-gradient(90deg,hsl(var(--warning)),transparent_78%)]" />
    <div className="flex flex-col gap-3 border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--primary)/0.05),transparent)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2
          className="text-base font-semibold tracking-[-0.01em] text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
    <div>{children}</div>
  </section>
);

const MetricCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) => (
  <div className="border border-border/80 bg-card px-4 py-4">
    <p
      className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </p>
    <p
      className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {value}
    </p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
  </div>
);

const EmptyPanel = ({ message }: { message: string }) => (
  <div className="px-5 py-10 text-sm leading-6 text-muted-foreground">{message}</div>
);

const PanelList = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-border/70">{children}</div>
);

const SnapshotRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-3.5">
    <span
      className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </span>
    <span className="text-sm text-foreground">{value}</span>
  </div>
);

const QuickAccessRow = ({
  icon: Icon,
  to,
  label,
}: {
  icon: typeof Search;
  to: string;
  label: string;
}) => (
  <Link to={to} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/10">
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </div>
    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
  </Link>
);

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
  <div className="flex items-start justify-between gap-3 px-5 py-4">
    <div className="min-w-0">
      <p
        className="truncate text-[13px] font-bold text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground/70">{meta}</p>
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
    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/10"
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
      <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
        {subscription.description || "Academic resource for online research and study."}
      </p>
      {subscription.category ? (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {subscription.category}
        </p>
      ) : null}
    </div>
  </a>
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
  const activityCount = (data?.borrow_history.length ?? 0) + (data?.reservation_history.length ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        <div
          className="absolute inset-0 z-10 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="relative z-10 h-[3px] w-full bg-warning" />
        <div className="absolute inset-y-0 left-0 z-10 w-[3px] bg-warning" />
        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-black/30" />

        <div className="container relative z-20 max-w-5xl px-4 py-14 sm:px-6 md:py-16">
          <motion.div initial="hidden" animate="visible" variants={fadeUp(0)}>
            <div className="flex items-center gap-3">
              <div className="h-px w-6 bg-warning shrink-0" />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Enverga-Candelaria Library
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h1
                  className="text-3xl font-bold tracking-tight leading-tight text-primary-foreground sm:text-4xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  My Library
                </h1>
              </div>

              <div className="min-w-[240px] border border-warning/25 bg-black/10 px-4 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-primary-foreground">
                  <UserRound className="h-4 w-4 text-warning" />
                  <span className="font-medium">{profile?.name ?? user?.name ?? "Library account"}</span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.15em] text-primary-foreground/55">
                  {profile?.student_employee_id ?? "Authenticated user"}
                </p>
                <p className="mt-3 text-xs leading-5 text-primary-foreground/45">
                  {summary?.active_borrows ?? 0} active borrows, {summary?.active_reservations ?? 0} active reservations
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="py-10 sm:py-12">
        <div className="container max-w-5xl px-4 sm:px-6">
          {error ? (
            <div className="mt-6 border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.1)}
            className="mt-8 grid gap-4 md:grid-cols-3"
          >
            <MetricCard
              label="Borrowing"
              value={summary?.active_borrows ?? 0}
              hint={`${summary?.due_soon_borrows ?? 0} due soon, ${summary?.overdue_borrows ?? 0} overdue`}
            />
            <MetricCard
              label="Reservations"
              value={summary?.active_reservations ?? 0}
              hint={`${summary?.ready_reservations ?? 0} ready for pickup`}
            />
            <MetricCard
              label="Account Standing"
              value={formatCurrency(summary?.total_fines_due)}
              hint={`${summary?.attendance_logs ?? 0} recorded library visits`}
            />
          </motion.div>

          {loading ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-56 animate-pulse border border-border bg-card/60" />
              ))}
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp(0.14)}
              className="mt-8"
            >
              <Tabs defaultValue="current" className="space-y-6">
                <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-none border border-border/80 bg-card/70 p-2 sm:grid-cols-3">
                  {[
                    ["current", "Current Activity"],
                    ["history", "History"],
                    ["updates", "Updates and Resources"],
                  ].map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="min-h-[56px] rounded-none border border-border/80 bg-background px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors data-[state=active]:border-warning/35 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="current" className="mt-0 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
                  <Surface title="Borrowed Books">
                    {data?.active_borrows.length ? (
                      <PanelList>
                        {data.active_borrows.map((book) => (
                          <div key={book.id} className="flex gap-0">
                            <div className={`w-[3px] shrink-0 ${book.status === "overdue" ? "bg-destructive/60" : "bg-info/50"}`} />
                            <div className="flex-1 px-5 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-[13px] font-bold text-foreground"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                  >
                                    {book.title}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
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

                              <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                                <span>Due {formatDate(book.due_date, "MMM d, yyyy h:mm a")}</span>
                                <span>{dueLabel(book.due_date)}</span>
                                <span>Borrowed {formatDate(book.borrowed_at, "MMM d, yyyy h:mm a")}</span>
                                {book.status === "overdue" ? (
                                  <span className="font-medium text-destructive">
                                    Fine {formatCurrency(book.fine_amount)}
                                  </span>
                                ) : (
                                  <span>{book.location || "Library circulation desk"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="No active borrowed books right now." />
                    )}
                  </Surface>

                  <div className="space-y-5">
                    <Surface title="Reservations">
                      {data?.active_reservations.length ? (
                        <PanelList>
                          {data.active_reservations.map((reservation) => (
                            <div key={reservation.id} className="flex gap-0">
                              <div className={`w-[3px] shrink-0 ${reservation.status === "ready" ? "bg-success/60" : "bg-info/50"}`} />
                              <div className="flex-1 px-5 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p
                                      className="truncate text-[13px] font-bold text-foreground"
                                      style={{ fontFamily: "var(--font-heading)" }}
                                    >
                                      {reservation.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
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

                                <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
                                  <span>Reserved {formatDate(reservation.reserved_at)}</span>
                                  {reservation.expires_at ? (
                                    <span>Pickup by {formatDate(reservation.expires_at, "MMM d, yyyy h:mm a")}</span>
                                  ) : null}
                                  <span>{reservation.location || "Main circulation desk"}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </PanelList>
                      ) : (
                        <EmptyPanel message="No active reservations at the moment." />
                      )}
                    </Surface>

                    <Surface title="At a Glance">
                      <div className="grid gap-0 divide-y divide-border/70">
                        <SnapshotRow label="Due soon" value={`${summary?.due_soon_borrows ?? 0} items`} />
                        <SnapshotRow label="Unread updates" value={`${unreadCount} notices`} />
                        <SnapshotRow label="Digital access" value={`${data?.subscriptions.length ?? 0} resources`} />
                      </div>
                    </Surface>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0 grid gap-5 lg:grid-cols-2">
                  <Surface title="Recent Activity">
                    {activityCount ? (
                      <PanelList>
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
                            meta={`${historyStatusConfig[item.status].label} | ${formatDate(item.reserved_at)}`}
                            badgeLabel="Reservation"
                          />
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="Your recent borrowing and reservation history will appear here." />
                    )}
                  </Surface>

                  <Surface title="Attendance History">
                    {data?.attendance_sessions.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/70 bg-muted/20">
                              {["Date", "Time In", "Time Out"].map((heading) => (
                                <th
                                  key={heading}
                                  className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
                                  style={{ fontFamily: "var(--font-heading)" }}
                                >
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/70">
                            {data.attendance_sessions.map((session, index) => (
                              <AttendanceRow key={`${session.date ?? "attendance"}-${index}`} session={session} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyPanel message="No attendance logs found yet." />
                    )}
                  </Surface>
                </TabsContent>

                <TabsContent value="updates" className="mt-0 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <Surface
                    title="Notifications"
                    actions={
                      notifications.length > 0 && unreadCount > 0 ? (
                        <button
                          onClick={() => void markAllAsRead()}
                          className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Mark all as read
                        </button>
                      ) : null
                    }
                  >
                    {notifications.length ? (
                      <PanelList>
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
                              <div className="flex-1 px-5 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <p
                                    className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                  >
                                    {notification.title}
                                  </p>
                                  <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    {relativeTime(notification.created_at)}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {notification.body}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="No urgent updates right now." />
                    )}
                  </Surface>

                  <div className="space-y-5">
                    <Surface title="Digital Resources">
                      {data?.subscriptions.length ? (
                        <PanelList>
                          {data.subscriptions.slice(0, 4).map((subscription) => (
                            <SubscriptionItem key={subscription.id} subscription={subscription} />
                          ))}
                        </PanelList>
                      ) : (
                        <EmptyPanel message="No academic subscriptions are available yet." />
                      )}

                      {data?.subscriptions.length ? (
                        <div className="border-t border-border/70 px-5 py-4">
                          <Link
                            to="/services/subscriptions"
                            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            View all resources
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ) : null}
                    </Surface>

                    <Surface title="Quick Access">
                      <div className="grid gap-0 divide-y divide-border/70">
                        <QuickAccessRow icon={Search} to="/catalogue" label="Search the catalogue" />
                        <QuickAccessRow icon={CalendarDays} to="/services/borrowing" label="Check reservation options" />
                        <QuickAccessRow icon={LibraryBig} to="/services/subscriptions" label="Open subscription list" />
                      </div>
                    </Surface>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.18)}
            className="mt-8"
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to}>
                  <button
                    className="flex min-h-[52px] w-full items-center gap-2.5 border border-border bg-card px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:border-primary/35 hover:bg-muted/30"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    {label}
                  </button>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyLibrary;
