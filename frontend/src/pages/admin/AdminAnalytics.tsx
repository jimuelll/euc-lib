import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookCopy,
  CalendarClock,
  Coins,
  RefreshCcw,
  ShieldAlert,
  Users,
} from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";

interface DashboardStats {
  total_books: number;
  total_book_copies: number;
  active_users: number;
  total_users: number;
  active_borrowings: number;
  overdue_borrowings: number;
  active_reservations: number;
  ready_reservations: number;
  attendance_today: number;
  unique_visitors_today: number;
  visit_hits_today: number;
  total_unique_visitors: number;
  total_visit_hits: number;
  active_notifications: number;
  active_subscriptions: number;
  upcoming_holidays: number;
  overdue_fine_per_hour: number;
  outstanding_fines: number;
}

interface NamedValue {
  name: string;
  value: number;
}

interface TrendPoint {
  label: string;
  unique_visitors?: number;
  visit_hits?: number;
  borrowed_count?: number;
  returned_count?: number;
}

interface PopularBookPoint {
  name: string;
  total: number;
}

interface DashboardResponse {
  stats: DashboardStats;
  charts: {
    visitTrend: TrendPoint[];
    circulationTrend: TrendPoint[];
    borrowingStatus: NamedValue[];
    reservationStatus: NamedValue[];
    userRoles: NamedValue[];
    popularBooks: PopularBookPoint[];
  };
}

const emptyData: DashboardResponse = {
  stats: {
    total_books: 0,
    total_book_copies: 0,
    active_users: 0,
    total_users: 0,
    active_borrowings: 0,
    overdue_borrowings: 0,
    active_reservations: 0,
    ready_reservations: 0,
    attendance_today: 0,
    unique_visitors_today: 0,
    visit_hits_today: 0,
    total_unique_visitors: 0,
    total_visit_hits: 0,
    active_notifications: 0,
    active_subscriptions: 0,
    upcoming_holidays: 0,
    overdue_fine_per_hour: 0,
    outstanding_fines: 0,
  },
  charts: {
    visitTrend: [],
    circulationTrend: [],
    borrowingStatus: [],
    reservationStatus: [],
    userRoles: [],
    popularBooks: [],
  },
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const chartPalette = ["#7f1d1d", "#b45309", "#0f766e", "#1d4ed8", "#6d28d9", "#be185d"];

const AdminAnalytics = () => {
  const [data, setData] = useState<DashboardResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError("");

    try {
      const res = await axiosInstance.get<DashboardResponse>("/api/admin/dashboard");
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const stats = [
    {
      label: "Books / Copies",
      value: `${data.stats.total_books} / ${data.stats.total_book_copies}`,
      helperText: "Catalog titles and active physical copies currently tracked.",
      icon: <BookCopy className="h-4 w-4" />,
    },
    {
      label: "Active Users",
      value: String(data.stats.active_users),
      helperText: `${data.stats.total_users} total accounts remain in the database.`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Overdue Borrowings",
      value: String(data.stats.overdue_borrowings),
      helperText: `${data.stats.active_borrowings} currently borrowed, excluding returns.`,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      label: "Total unsettled payments",
      value: currencyFormatter.format(data.stats.outstanding_fines),
      helperText: `${currencyFormatter.format(data.stats.overdue_fine_per_hour)} added per overdue hour.`,
      icon: <Coins className="h-4 w-4" />,
    },
    {
      label: "Upcoming Holidays",
      value: String(data.stats.upcoming_holidays),
      helperText: `${data.stats.ready_reservations} reservations are ready for pickup.`,
      icon: <CalendarClock className="h-4 w-4" />,
    },
  ];

  return (
    <AdminPage
      eyebrow="Analytics"
      title="Operations Analytics"
      description="A charts-first view of library traffic, circulation flow, account distribution, and fine exposure based on the data already present in the database."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => void loadDashboard("refresh")}
          disabled={loading || refreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      }
    >
      <AdminStatGrid>
        {stats.map((stat) => (
          <AdminStatCard
            key={stat.label}
            label={stat.label}
            value={loading ? "..." : stat.value}
            helperText={stat.helperText}
            icon={stat.icon}
          />
        ))}
      </AdminStatGrid>

      {error ? (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Site Traffic Trend" description="Unique visitors and total tracked hits over the last seven days.">
          <ChartContainer className="h-[240px] w-full sm:h-[280px]" config={{ unique_visitors: { label: "Unique Visitors", color: "#7f1d1d" }, visit_hits: { label: "Visit Hits", color: "#b45309" } }}>
            <LineChart data={data.charts.visitTrend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="unique_visitors" stroke="var(--color-unique_visitors)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="visit_hits" stroke="var(--color-visit_hits)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Circulation Trend" description="Borrow and return volume over the last seven days.">
          <ChartContainer className="h-[240px] w-full sm:h-[280px]" config={{ borrowed_count: { label: "Borrowed", color: "#1d4ed8" }, returned_count: { label: "Returned", color: "#0f766e" } }}>
            <BarChart data={data.charts.circulationTrend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="borrowed_count" fill="var(--color-borrowed_count)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="returned_count" fill="var(--color-returned_count)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Borrowing Status Mix" description="Live borrowing distribution across active, overdue, and returned states.">
          <ChartContainer
            className="h-[240px] w-full sm:h-[280px]"
            config={Object.fromEntries(data.charts.borrowingStatus.map((item, index) => [item.name, { label: item.name, color: chartPalette[index % chartPalette.length] }]))}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={data.charts.borrowingStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                {data.charts.borrowingStatus.map((item, index) => (
                  <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="User Role Distribution" description="Current account mix across roles in the users table.">
          <ChartContainer className="h-[240px] w-full sm:h-[280px]" config={{ value: { label: "Users", color: "#7f1d1d" } }}>
            <BarChart data={data.charts.userRoles} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={72} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel title="Most Borrowed Books" description="Top borrowed titles based on the complete borrowing history.">
          <ChartContainer className="h-[260px] w-full sm:h-[300px]" config={{ total: { label: "Borrow Count", color: "#b45309" } }}>
            <BarChart data={data.charts.popularBooks} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminPanel>

        <AdminPanel title="Reservation and System Snapshot" description="Quick visibility into reservation pressure and active platform content.">
          <div className="space-y-4">
            <SnapshotRow label="Active reservations" value={data.stats.active_reservations} />
            <SnapshotRow label="Ready reservations" value={data.stats.ready_reservations} />
            <SnapshotRow label="Attendance scans today" value={data.stats.attendance_today} />
            <SnapshotRow label="Notifications" value={data.stats.active_notifications} />
            <SnapshotRow label="Active subscriptions" value={data.stats.active_subscriptions} />
            <SnapshotRow label="Visitors today" value={`${data.stats.unique_visitors_today} / ${data.stats.visit_hits_today}`} />
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
};

const SnapshotRow = ({ label, value }: { label: string; value: number | string }) => (
  <div className="flex items-center justify-between border border-border/70 px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
      {value}
    </span>
  </div>
);

export default AdminAnalytics;
