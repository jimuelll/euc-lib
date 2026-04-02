import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Coins, RefreshCcw, ShieldAlert, Users } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";

interface HomeStats {
  total_books: number;
  active_users: number;
  active_borrowings: number;
  overdue_borrowings: number;
  outstanding_fines: number;
  upcoming_holidays: number;
}

interface HomeResponse {
  stats: HomeStats;
}

const emptyStats: HomeStats = {
  total_books: 0,
  active_users: 0,
  active_borrowings: 0,
  overdue_borrowings: 0,
  outstanding_fines: 0,
  upcoming_holidays: 0,
};

const adminQuickLinks = [
  { title: "Analytics", description: "Open the full charts and trends dashboard.", href: "/admin/analytics" },
  { title: "Circulation", description: "Process borrowing and returns at the desk.", href: "/admin/circulation" },
  { title: "Reports", description: "Review circulation and reservation records by date range.", href: "/admin/report" },
  { title: "Payments", description: "Review fine exposure and settle unsettled balances.", href: "/admin/payment" },
];

const staffQuickLinks = [
  { title: "Catalog", description: "Check titles, copies, and catalog details.", href: "/admin/catalog" },
  { title: "Circulation", description: "Process borrowing and returns at the desk.", href: "/admin/circulation" },
  { title: "Reservations", description: "Handle reservation queues and pickups.", href: "/admin/reservations" },
  { title: "Holidays", description: "Review configured holiday dates that affect due dates.", href: "/admin/holidays" },
];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const AdminHome = () => {
  const { user } = useAuth();
  const canSeeAnalytics = ["admin", "super_admin"].includes(user?.role ?? "");
  const [stats, setStats] = useState<HomeStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = async (mode: "initial" | "refresh" = "initial") => {
    if (!canSeeAnalytics) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    try {
      const res = await axiosInstance.get<HomeResponse>("/api/admin/dashboard");
      setStats({
        total_books: res.data.stats.total_books,
        active_users: res.data.stats.active_users,
        active_borrowings: res.data.stats.active_borrowings,
        overdue_borrowings: res.data.stats.overdue_borrowings,
        outstanding_fines: res.data.stats.outstanding_fines,
        upcoming_holidays: res.data.stats.upcoming_holidays,
      });
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [canSeeAnalytics]);

  return (
    <AdminPage
      eyebrow="Home"
      title="Library Overview"
      description={
        canSeeAnalytics
          ? "A compact pulse check for today's operations. Use Analytics for the full chart-heavy breakdown."
          : "A lightweight operations landing page for day-to-day library work."
      }
      actions={canSeeAnalytics ? (
        <Button type="button" variant="outline" className="rounded-none" onClick={() => void loadOverview("refresh")} disabled={loading || refreshing}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Overview
        </Button>
      ) : undefined}
      contentWidth="wide"
    >
      {canSeeAnalytics ? (
        <AdminStatGrid>
          <AdminStatCard label="Books" value={loading ? "..." : String(stats.total_books)} helperText="Non-archived catalog titles." icon={<ArrowRight className="h-4 w-4" />} />
          <AdminStatCard label="Active Users" value={loading ? "..." : String(stats.active_users)} helperText="Current active accounts in the system." icon={<Users className="h-4 w-4" />} />
          <AdminStatCard label="Overdue Borrowings" value={loading ? "..." : String(stats.overdue_borrowings)} helperText={`${stats.active_borrowings} active borrowings in total.`} icon={<ShieldAlert className="h-4 w-4" />} />
          <AdminStatCard label="Total unsettled payments" value={loading ? "..." : currencyFormatter.format(stats.outstanding_fines)} helperText={`${stats.upcoming_holidays} upcoming holiday date(s) configured.`} icon={<Coins className="h-4 w-4" />} />
        </AdminStatGrid>
      ) : null}

      <AdminPanel
        title="Quick Actions"
        description={
          canSeeAnalytics
            ? "The Home page stays lightweight and operational. Open Analytics when you need trendlines, role charts, and deeper reporting."
            : "These are the day-to-day tools available to staff from the admin workspace."
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(canSeeAnalytics ? adminQuickLinks : staffQuickLinks).map((item) => (
            <Link key={item.href} to={item.href} className="block border border-border/80 bg-card p-4 transition-colors hover:bg-muted/20">
              <h3 className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminHome;
