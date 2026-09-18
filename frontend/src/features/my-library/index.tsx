import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ExternalLink, GraduationCap, Search, UserRound } from "lucide-react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicPageMasthead from "@/components/layout/PublicPageMasthead";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useMyLibrary } from "./hooks/useMyLibrary";
import { useMyLibraryActivity } from "./hooks/useMyLibraryActivity";
import { RecommendationStrip } from "@/features/recommendations";
import MyLibraryCurrentPanel from "./components/MyLibraryCurrentPanel";
import MyLibraryHistoryPanel from "./components/MyLibraryHistoryPanel";
import MyLibraryUpdatesPanel from "./components/MyLibraryUpdatesPanel";
import type { ActiveBorrow, ActiveReservation, AttendanceSession, DashboardSubscription } from "./types";

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
  const { attendanceLoading, attendancePage, historyLoading, historyPage, loadAttendance, loadHistory } = useMyLibraryActivity(!authLoading && Boolean(user));
  const {
    notifications: liveNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const profile = data?.profile;
  const summary = data?.summary;
  const notifications = liveNotifications.length ? liveNotifications : (data?.notifications ?? []);
  const activityCount = historyPage?.pagination.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <PublicPageMasthead title="My Library" description="Track your borrowing, reservations, and library activity.">
        <motion.div initial="hidden" animate="visible" variants={fadeUp(0)} className="max-w-sm border border-warning/25 bg-black/10 px-4 py-3.5">
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
        </motion.div>
      </PublicPageMasthead>

      <main className="py-8 sm:py-10">
        <div className="container max-w-5xl px-5 sm:px-8 lg:px-12">
          {error ? (
            <div className="mt-6 border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp(0.1)}
            className="mt-6 grid gap-4 md:grid-cols-3"
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

          <div className="mt-8 space-y-5">
            <RecommendationStrip personal materialType="book" />
            <RecommendationStrip personal materialType="thesis" />
          </div>

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

                <MyLibraryCurrentPanel data={data} summary={summary} unreadCount={unreadCount} />
                <MyLibraryHistoryPanel
                  data={data}
                  historyLoading={historyLoading}
                  historyPage={historyPage}
                  attendanceLoading={attendanceLoading}
                  attendancePage={attendancePage}
                  activityCount={activityCount}
                  loadHistory={loadHistory}
                  loadAttendance={loadAttendance}
                />
                <MyLibraryUpdatesPanel
                  data={data}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  markAsRead={markAsRead}
                  markAllAsRead={markAllAsRead}
                />
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
