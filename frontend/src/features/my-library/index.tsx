import { motion } from "framer-motion";
import { CalendarDays, GraduationCap, Search, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicPageMasthead from "@/components/layout/PublicPageMasthead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useMyLibrary } from "./hooks/useMyLibrary";
import { useMyLibraryActivity } from "./hooks/useMyLibraryActivity";
import { RecommendationStrip } from "@/features/recommendations";
import MyLibraryCurrentPanel from "./components/MyLibraryCurrentPanel";
import MyLibraryHistoryPanel from "./components/MyLibraryHistoryPanel";
import MyLibraryUpdatesPanel from "./components/MyLibraryUpdatesPanel";

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay } },
});

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const formatCurrency = (value?: number | null) => currencyFormatter.format(Number(value || 0));

const quickLinks = [
  { to: "/catalogue", icon: Search, label: "Browse Catalogue" },
  { to: "/services/borrowing", icon: CalendarDays, label: "Reservations" },
  { to: "/services/subscriptions", icon: GraduationCap, label: "Digital Resources" },
  { to: "/edit-profile", icon: UserRound, label: "Edit Profile" },
];

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
