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
  ArchiveRestore,
  BookMarked,
  BookCopy,
  Coins,
  ClipboardCheck,
  DoorOpen,
  LibraryBig,
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
  available_book_copies: number;
  borrowed_book_copies: number;
  damaged_book_copies: number;
  lost_book_copies: number;
  active_users: number;
  total_users: number;
  active_borrowings: number;
  overdue_borrowings: number;
  borrowings_today: number;
  returns_today: number;
  active_reservations: number;
  ready_reservations: number;
  reservations_today: number;
  fulfilled_reservations_today: number;
  attendance_today: number;
  borrowing_attendance_today: number;
  entry_exit_attendance_today: number;
  unique_visitors_today: number;
  visit_hits_today: number;
  total_unique_visitors: number;
  total_visit_hits: number;
  active_notifications: number;
  active_subscriptions: number;
  upcoming_holidays: number;
  settled_fines_total: number;
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
  entry_exit_count?: number;
  borrowing_count?: number;
  created_count?: number;
  fulfilled_count?: number;
  cancelled_count?: number;
  settled_amount?: number;
}

interface PopularBookPoint {
  name: string;
  total: number;
}

interface CategoryPoint {
  name: string;
  titles: number;
  copies: number;
}

interface DashboardResponse {
  stats: DashboardStats;
  charts: {
    visitTrend: TrendPoint[];
    circulationTrend: TrendPoint[];
    attendanceTrend: TrendPoint[];
    reservationTrend: TrendPoint[];
    borrowingStatus: NamedValue[];
    reservationStatus: NamedValue[];
    userRoles: NamedValue[];
    popularBooks: PopularBookPoint[];
    catalogByCategory: CategoryPoint[];
    copyCondition: NamedValue[];
    borrowingByRole: NamedValue[];
    fineCollectionTrend: TrendPoint[];
  };
}

const emptyData: DashboardResponse = {
  stats: {
    total_books: 0,
    total_book_copies: 0,
    available_book_copies: 0,
    borrowed_book_copies: 0,
    damaged_book_copies: 0,
    lost_book_copies: 0,
    active_users: 0,
    total_users: 0,
    active_borrowings: 0,
    overdue_borrowings: 0,
    borrowings_today: 0,
    returns_today: 0,
    active_reservations: 0,
    ready_reservations: 0,
    reservations_today: 0,
    fulfilled_reservations_today: 0,
    attendance_today: 0,
    borrowing_attendance_today: 0,
    entry_exit_attendance_today: 0,
    unique_visitors_today: 0,
    visit_hits_today: 0,
    total_unique_visitors: 0,
    total_visit_hits: 0,
    active_notifications: 0,
    active_subscriptions: 0,
    upcoming_holidays: 0,
    settled_fines_total: 0,
    overdue_fine_per_hour: 0,
    outstanding_fines: 0,
  },
  charts: {
    visitTrend: [],
    circulationTrend: [],
    attendanceTrend: [],
    reservationTrend: [],
    borrowingStatus: [],
    reservationStatus: [],
    userRoles: [],
    popularBooks: [],
    catalogByCategory: [],
    copyCondition: [],
    borrowingByRole: [],
    fineCollectionTrend: [],
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

  const topStats = [
    {
      label: "Borrowings Today",
      value: String(data.stats.borrowings_today),
      helperText: `${data.stats.active_borrowings} items are currently on loan.`,
      icon: <ArchiveRestore className="h-4 w-4" />,
    },
    {
      label: "Returns Today",
      value: String(data.stats.returns_today),
      helperText: `${data.stats.overdue_borrowings} borrowings are overdue right now.`,
      icon: <BookCopy className="h-4 w-4" />,
    },
    {
      label: "Reservations Today",
      value: String(data.stats.reservations_today),
      helperText: `${data.stats.ready_reservations} reservations are ready for pickup.`,
      icon: <BookMarked className="h-4 w-4" />,
    },
    {
      label: "Attendance Today",
      value: String(data.stats.attendance_today),
      helperText: `${data.stats.entry_exit_attendance_today} entry scans and ${data.stats.borrowing_attendance_today} borrowing scans were logged.`,
      icon: <DoorOpen className="h-4 w-4" />,
    },
    {
      label: "Overdue Borrowings",
      value: String(data.stats.overdue_borrowings),
      helperText: `${currencyFormatter.format(data.stats.outstanding_fines)} remains unsettled.`,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      label: "Available Copies",
      value: String(data.stats.available_book_copies),
      helperText: `${data.stats.borrowed_book_copies} copies are on loan right now.`,
      icon: <LibraryBig className="h-4 w-4" />,
    },
  ];

  const healthStats = [
    {
      label: "Total Titles",
      value: String(data.stats.total_books),
      helperText: `${data.stats.total_book_copies} active copies are tracked in inventory.`,
      icon: <BookCopy className="h-4 w-4" />,
    },
    {
      label: "Active Users",
      value: String(data.stats.active_users),
      helperText: `${data.stats.total_users} total accounts remain in the database.`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Outstanding Fines",
      value: currencyFormatter.format(data.stats.outstanding_fines),
      helperText: `${currencyFormatter.format(data.stats.settled_fines_total)} collected so far, with ${currencyFormatter.format(data.stats.overdue_fine_per_hour)} added per overdue hour.`,
      icon: <Coins className="h-4 w-4" />,
    },
    {
      label: "Damaged Copies",
      value: String(data.stats.damaged_book_copies),
      helperText: `${data.stats.lost_book_copies} copies are marked lost.`,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      label: "Site Visitors Today",
      value: String(data.stats.unique_visitors_today),
      helperText: `${data.stats.visit_hits_today} total page hits were recorded.`,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
  ];

  return (
    <AdminPage
      eyebrow="Analytics"
      title="Operations Analytics"
      description="A clearer operations view of circulation, collection health, patron activity, and fine exposure."
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
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Today At A Glance
          </h2>
          <p className="text-sm text-muted-foreground">
            The first row focuses on what library staff usually need to react to immediately.
          </p>
        </div>

        <AdminStatGrid>
          {topStats.map((stat) => (
            <AdminStatCard
              key={stat.label}
              label={stat.label}
              value={loading ? "..." : stat.value}
              helperText={stat.helperText}
              icon={stat.icon}
            />
          ))}
        </AdminStatGrid>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Collection And System Health
          </h2>
          <p className="text-sm text-muted-foreground">
            This section keeps broader health indicators separate from today&apos;s operational queue.
          </p>
        </div>

        <AdminStatGrid>
          {healthStats.map((stat) => (
            <AdminStatCard
              key={stat.label}
              label={stat.label}
              value={loading ? "..." : stat.value}
              helperText={stat.helperText}
              icon={stat.icon}
            />
          ))}
        </AdminStatGrid>
      </section>

      {error ? (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Circulation
          </h2>
          <p className="text-sm text-muted-foreground">
            Borrowing, returns, reservations, and the titles driving demand.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
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

          <AdminPanel title="Reservation Flow" description="Requests created, fulfilled, and cancelled over the last seven days.">
            <ChartContainer
              className="h-[240px] w-full sm:h-[280px]"
              config={{
                created_count: { label: "Created", color: "#1d4ed8" },
                fulfilled_count: { label: "Fulfilled", color: "#0f766e" },
                cancelled_count: { label: "Cancelled", color: "#b45309" },
              }}
            >
              <BarChart data={data.charts.reservationTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="created_count" fill="var(--color-created_count)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="fulfilled_count" fill="var(--color-fulfilled_count)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="cancelled_count" fill="var(--color-cancelled_count)" radius={[2, 2, 0, 0]} />
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

          <AdminPanel title="Circulation Snapshot" description="A quick operational summary without forcing you to decode combined figures.">
            <div className="space-y-4">
              <SnapshotRow label="Items currently borrowed" value={data.stats.active_borrowings} />
              <SnapshotRow label="Overdue borrowings" value={data.stats.overdue_borrowings} />
              <SnapshotRow label="Active reservations" value={data.stats.active_reservations} />
              <SnapshotRow label="Ready for pickup" value={data.stats.ready_reservations} />
              <SnapshotRow label="Fulfilled reservations today" value={data.stats.fulfilled_reservations_today} />
              <SnapshotRow label="Borrowing attendance today" value={data.stats.borrowing_attendance_today} />
            </div>
          </AdminPanel>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Collection Health
          </h2>
          <p className="text-sm text-muted-foreground">
            Inventory quality, category spread, and who the collection is serving.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel title="Catalog by Category" description="Title and copy concentration across the catalog categories currently stored in the books table.">
            <ChartContainer
              className="h-[280px] w-full sm:h-[320px]"
              config={{
                titles: { label: "Titles", color: "#7f1d1d" },
                copies: { label: "Copies", color: "#b45309" },
              }}
            >
              <BarChart data={data.charts.catalogByCategory} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="titles" fill="var(--color-titles)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="copies" fill="var(--color-copies)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </AdminPanel>

          <AdminPanel title="Inventory Condition Mix" description="Active physical-copy condition based on the dedicated copy records in the schema.">
            <ChartContainer
              className="h-[280px] w-full sm:h-[320px]"
              config={Object.fromEntries(data.charts.copyCondition.map((item, index) => [item.name, { label: item.name, color: chartPalette[index % chartPalette.length] }]))}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={data.charts.copyCondition} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88}>
                  {data.charts.copyCondition.map((item, index) => (
                    <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </AdminPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel title="Borrowing Demand by User Role" description="Total circulation demand by account role, useful for spotting who the collection is serving most.">
            <ChartContainer className="h-[250px] w-full sm:h-[300px]" config={{ value: { label: "Borrowings", color: "#1d4ed8" } }}>
              <BarChart data={data.charts.borrowingByRole} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={72} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ChartContainer>
          </AdminPanel>

          <AdminPanel title="Collection Notes" description="Important operational details that work better as labeled rows than mixed stat cards.">
            <div className="space-y-4">
              <SnapshotRow label="Active copies" value={data.stats.total_book_copies} />
              <SnapshotRow label="Available copies" value={data.stats.available_book_copies} />
              <SnapshotRow label="Borrowed copies" value={data.stats.borrowed_book_copies} />
              <SnapshotRow label="Damaged copies" value={data.stats.damaged_book_copies} />
              <SnapshotRow label="Lost copies" value={data.stats.lost_book_copies} />
              <SnapshotRow label="Upcoming holidays" value={data.stats.upcoming_holidays} />
            </div>
          </AdminPanel>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Patron And Platform Activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Foot traffic, account distribution, site usage, and payment activity.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel title="Attendance Trend" description="Entry and borrowing scans captured over the last seven days.">
            <ChartContainer
              className="h-[240px] w-full sm:h-[280px]"
              config={{
                entry_exit_count: { label: "Entry / Exit", color: "#7f1d1d" },
                borrowing_count: { label: "Borrowing", color: "#0f766e" },
              }}
            >
              <LineChart data={data.charts.attendanceTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="entry_exit_count" stroke="var(--color-entry_exit_count)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="borrowing_count" stroke="var(--color-borrowing_count)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </AdminPanel>

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
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
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

          <AdminPanel title="Fine Collections Trend" description="Settled overdue payments over the last six months based on borrowing settlement timestamps.">
            <ChartContainer className="h-[250px] w-full sm:h-[300px]" config={{ settled_amount: { label: "Settled Fines", color: "#0f766e" } }}>
              <LineChart data={data.charts.fineCollectionTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => currencyFormatter.format(Number(value || 0))} />} />
                <Line type="monotone" dataKey="settled_amount" stroke="var(--color-settled_amount)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </AdminPanel>
        </div>
      </section>
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
