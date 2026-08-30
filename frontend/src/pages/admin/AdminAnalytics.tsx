import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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
  AlertTriangle,
  BarChart3,
  BookMarked,
  BookCopy,
  Coins,
  DoorOpen,
  LibraryBig,
  PackageCheck,
  RefreshCcw,
  CheckCircle2,
  ShieldAlert,
  List,
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
import { AdminPage, AdminPanel } from "./components/AdminPage";

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
type AnalyticsRange = "7d" | "30d" | "month" | "year";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const AdminAnalytics = () => {
  const [data, setData] = useState<DashboardResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [groupViews, setGroupViews] = useState({
    circulation: "charts" as "charts" | "text",
    collection: "charts" as "charts" | "text",
    activity: "charts" as "charts" | "text",
  });

  const loadDashboard = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError("");

    try {
      const res = await axiosInstance.get<DashboardResponse>("/api/admin/dashboard", { params: { range } });
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
  }, [range]);

  return (
    <AdminPage
      eyebrow="Analytics"
      title="Operations Analytics"
      actions={<Button type="button" variant="outline" className="rounded-none" onClick={() => void loadDashboard("refresh")} disabled={loading || refreshing}><RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh Data</Button>}
    >
      <AdminPanel title="Library status" contentClassName="p-0">
        <div className="grid divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          <StatusItem
            icon={data.stats.overdue_borrowings ? AlertTriangle : CheckCircle2}
            tone={data.stats.overdue_borrowings ? "critical" : "clear"}
            title={data.stats.overdue_borrowings ? `${data.stats.overdue_borrowings} overdue item${data.stats.overdue_borrowings === 1 ? "" : "s"}` : "No overdue items"}
            detail={data.stats.overdue_borrowings ? "Requires follow-up" : "All clear"}
          />
          <StatusItem
            icon={data.stats.outstanding_fines > 0 ? Coins : CheckCircle2}
            tone={data.stats.outstanding_fines > 0 ? "critical" : "clear"}
            title={data.stats.outstanding_fines > 0 ? `${currencyFormatter.format(data.stats.outstanding_fines)} unsettled` : "No outstanding fines"}
            detail={data.stats.outstanding_fines > 0 ? "Payment follow-up needed" : "All fines are settled"}
          />
          <StatusItem
            icon={BookMarked}
            tone={data.stats.ready_reservations ? "attention" : "clear"}
            title={`${data.stats.ready_reservations} reservation${data.stats.ready_reservations === 1 ? "" : "s"} ready`}
            detail={data.stats.ready_reservations ? "Awaiting pickup" : "Nothing awaiting pickup"}
          />
        </div>
      </AdminPanel>

      <AdminPanel title="Today's operations" contentClassName="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Overdue borrowings" value={data.stats.overdue_borrowings} icon={ShieldAlert} tone="critical" loading={loading} />
          <MetricCard label="Reservations ready" value={data.stats.ready_reservations} icon={BookMarked} tone="attention" loading={loading} />
          <MetricCard label="Borrowings today" value={data.stats.borrowings_today} icon={ArchiveRestore} loading={loading} />
          <MetricCard label="Returns today" value={data.stats.returns_today} icon={BookCopy} loading={loading} />
          <MetricCard label="Attendance today" value={data.stats.attendance_today} icon={DoorOpen} loading={loading} />
        </div>
      </AdminPanel>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="Core library metrics">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Active users" value={data.stats.active_users} icon={Users} loading={loading} />
            <MetricCard label="Catalog titles" value={data.stats.total_books} icon={LibraryBig} loading={loading} />
            <MetricCard label="Copies on loan" value={data.stats.borrowed_book_copies} icon={BookCopy} loading={loading} />
            <MetricCard label="Available copies" value={data.stats.available_book_copies} icon={PackageCheck} loading={loading} />
          </div>
        </AdminPanel>
        <AdminPanel title="Reference metrics">
          <div className="divide-y divide-border/70">
            <CompactMetric label="Damaged copies" value={data.stats.damaged_book_copies} />
            <CompactMetric label="Lost copies" value={data.stats.lost_book_copies} />
            <CompactMetric label="Site visitors today" value={data.stats.unique_visitors_today} />
            <CompactMetric label="Site page hits today" value={data.stats.visit_hits_today} />
            <CompactMetric label="Upcoming holidays" value={data.stats.upcoming_holidays} />
          </div>
        </AdminPanel>
      </div>

      {error ? (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-border/80 bg-card/95 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Quick filters</span>
        <div className="flex flex-wrap items-center gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button key={option.value} type="button" onClick={() => setRange(option.value)} className={`border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${range === option.value ? "border-warning text-warning" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{option.label}</button>
          ))}
        </div>
      </div>

      {groupViews.circulation === "text" ? <AnalyticsTextView group="circulation" data={data} loading={loading} rangeLabel={RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Selected period"} onViewChange={(view) => setGroupViews((current) => ({ ...current, circulation: view }))} /> : <AnalyticsGroup title="Circulation and reservations" summary="Trends, demand, and current circulation status." defaultOpen actions={<AnalyticsModeToggle value="charts" onChange={(view) => setGroupViews((current) => ({ ...current, circulation: view }))} />}>

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
      </AnalyticsGroup>}

      {groupViews.collection === "text" ? <AnalyticsTextView group="collection" data={data} loading={loading} rangeLabel={RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Selected period"} onViewChange={(view) => setGroupViews((current) => ({ ...current, collection: view }))} /> : <AnalyticsGroup title="Collection health" summary="Inventory mix, condition, and collection use by role." actions={<AnalyticsModeToggle value="charts" onChange={(view) => setGroupViews((current) => ({ ...current, collection: view }))} />}>

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
      </AnalyticsGroup>}

      {groupViews.activity === "text" ? <AnalyticsTextView group="activity" data={data} loading={loading} rangeLabel={RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Selected period"} onViewChange={(view) => setGroupViews((current) => ({ ...current, activity: view }))} /> : <AnalyticsGroup title="Patron and platform activity" summary="Attendance, visitors, account mix, and fine collections." actions={<AnalyticsModeToggle value="charts" onChange={(view) => setGroupViews((current) => ({ ...current, activity: view }))} />}>

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
      </AnalyticsGroup>}
    </AdminPage>
  );
};

const AnalyticsTextView = ({ group, data, loading, rangeLabel, onViewChange }: { group: "circulation" | "collection" | "activity"; data: DashboardResponse; loading: boolean; rangeLabel: string; onViewChange: (view: "charts" | "text") => void }) => {
  const sum = (items: TrendPoint[], key: keyof TrendPoint) => items.reduce((total, item) => total + Number(item[key] || 0), 0);

  return group === "circulation" ? (
      <AnalyticsGroup title="Circulation and reservations" summary={`Readable totals for ${rangeLabel.toLowerCase()}.`} defaultOpen actions={<AnalyticsModeToggle value="text" onChange={onViewChange} />}>
        <div className="grid gap-5 xl:grid-cols-2">
          <AdminPanel title="Circulation totals"><TextMetricGrid loading={loading} metrics={[{ label: "Borrowed", value: sum(data.charts.circulationTrend, "borrowed_count") }, { label: "Returned", value: sum(data.charts.circulationTrend, "returned_count") }, { label: "Currently borrowed", value: data.stats.active_borrowings }, { label: "Overdue", value: data.stats.overdue_borrowings, tone: "critical" }]} /></AdminPanel>
          <AdminPanel title="Reservation totals"><TextMetricGrid loading={loading} metrics={[{ label: "Created", value: sum(data.charts.reservationTrend, "created_count") }, { label: "Fulfilled", value: sum(data.charts.reservationTrend, "fulfilled_count") }, { label: "Cancelled", value: sum(data.charts.reservationTrend, "cancelled_count") }, { label: "Ready for pickup", value: data.stats.ready_reservations, tone: "attention" }]} /></AdminPanel>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><AdminPanel title="Most borrowed books"><RankedList items={data.charts.popularBooks.map((item) => ({ label: item.name, value: item.total }))} emptyText="No borrowing history yet." /></AdminPanel><AdminPanel title="Current circulation"><div className="divide-y divide-border/70"><CompactMetric label="Active reservations" value={data.stats.active_reservations} /><CompactMetric label="Fulfilled today" value={data.stats.fulfilled_reservations_today} /><CompactMetric label="Borrowing attendance" value={data.stats.borrowing_attendance_today} /></div></AdminPanel></div>
      </AnalyticsGroup>
  ) : group === "collection" ? (

      <AnalyticsGroup title="Collection health" summary="Catalog and inventory figures in a compact reading layout." actions={<AnalyticsModeToggle value="text" onChange={onViewChange} />}>
        <div className="grid gap-5 xl:grid-cols-2"><AdminPanel title="Catalog by category"><RankedList items={data.charts.catalogByCategory.map((item) => ({ label: item.name, value: `${item.titles} titles · ${item.copies} copies` }))} emptyText="No catalog categories yet." /></AdminPanel><AdminPanel title="Inventory condition"><RankedList items={data.charts.copyCondition.map((item) => ({ label: item.name, value: item.value, tone: item.name === "damaged" || item.name === "lost" ? "attention" : "neutral" }))} emptyText="No copy conditions recorded." /></AdminPanel></div>
        <div className="grid gap-5 xl:grid-cols-2"><AdminPanel title="Borrowing by user role"><RankedList items={data.charts.borrowingByRole.map((item) => ({ label: item.name, value: item.value }))} emptyText="No borrowing activity yet." /></AdminPanel><AdminPanel title="Collection reference"><div className="divide-y divide-border/70"><CompactMetric label="Active copies" value={data.stats.total_book_copies} /><CompactMetric label="Available copies" value={data.stats.available_book_copies} /><CompactMetric label="Damaged copies" value={data.stats.damaged_book_copies} /><CompactMetric label="Lost copies" value={data.stats.lost_book_copies} /></div></AdminPanel></div>
      </AnalyticsGroup>
  ) : (

      <AnalyticsGroup title="Patron and platform activity" summary="Attendance, website activity, users, and fine collections in text form." actions={<AnalyticsModeToggle value="text" onChange={onViewChange} />}>
        <div className="grid gap-5 xl:grid-cols-2"><AdminPanel title="Seven-day activity"><TextMetricGrid loading={loading} metrics={[{ label: "Entry / exit scans", value: sum(data.charts.attendanceTrend, "entry_exit_count") }, { label: "Borrowing scans", value: sum(data.charts.attendanceTrend, "borrowing_count") }, { label: "Site visitors", value: sum(data.charts.visitTrend, "unique_visitors") }, { label: "Page hits", value: sum(data.charts.visitTrend, "visit_hits") }]} /></AdminPanel><AdminPanel title="Fine collections"><TextMetricGrid loading={loading} metrics={[{ label: "Settled this period", value: currencyFormatter.format(sum(data.charts.fineCollectionTrend, "settled_amount")) }, { label: "Outstanding fines", value: currencyFormatter.format(data.stats.outstanding_fines), tone: data.stats.outstanding_fines > 0 ? "critical" : "neutral" }, { label: "Active users", value: data.stats.active_users }, { label: "Active notifications", value: data.stats.active_notifications }]} /></AdminPanel></div>
        <AdminPanel title="User role distribution"><RankedList items={data.charts.userRoles.map((item) => ({ label: item.name, value: item.value }))} emptyText="No active users found." /></AdminPanel>
      </AnalyticsGroup>
  );
};

const TextMetricGrid = ({ loading, metrics }: { loading: boolean; metrics: { label: string; value: number | string; tone?: "neutral" | "attention" | "critical" }[] }) => <div className="grid gap-3 sm:grid-cols-2">{metrics.map((metric) => <TextMetric key={metric.label} {...metric} loading={loading} />)}</div>;

const TextMetric = ({ label, value, tone = "neutral", loading }: { label: string; value: number | string; tone?: "neutral" | "attention" | "critical"; loading: boolean }) => <div className={`border p-4 ${tone === "critical" ? "border-l-4 border-destructive/80 bg-destructive/5" : tone === "attention" ? "border-l-4 border-warning/80 bg-warning/5" : "border-border/80 bg-background"}`}><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{label}</p><p className="mt-3 text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{loading ? "..." : value}</p></div>;

const RankedList = ({ items, emptyText }: { items: { label: string; value: number | string; tone?: "neutral" | "attention" }[]; emptyText: string }) => items.length ? <div className="divide-y divide-border/70">{items.map((item) => <div key={item.label} className={`flex items-center justify-between gap-4 py-3 ${item.tone === "attention" ? "text-warning" : ""}`}><span className="text-sm capitalize text-foreground">{item.label}</span><span className="shrink-0 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{item.value}</span></div>)}</div> : <p className="text-sm text-muted-foreground">{emptyText}</p>;

const AnalyticsGroup = ({
  title,
  summary,
  defaultOpen = false,
  actions,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <details open={defaultOpen} className="admin-panel-surface admin-etched-border border border-border/80 bg-card/95">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden sm:px-6">
      <div>
        <h2 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>
      <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
        {actions}
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Details</span>
      </div>
    </summary>
    <div className="space-y-6 border-t border-border/70 p-5 sm:p-6">{children}</div>
  </details>
);

const AnalyticsModeToggle = ({ value, onChange }: { value: "charts" | "text"; onChange: (view: "charts" | "text") => void }) => (
  <div className="flex overflow-hidden border border-border" role="group" aria-label="Section display mode">
    <Button type="button" size="sm" variant={value === "charts" ? "default" : "ghost"} className="rounded-none" onClick={() => onChange("charts")}><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Charts</Button>
    <Button type="button" size="sm" variant={value === "text" ? "default" : "ghost"} className="rounded-none" onClick={() => onChange("text")}><List className="mr-1.5 h-3.5 w-3.5" />Text</Button>
  </div>
);

const StatusItem = ({
  icon: Icon,
  tone,
  title,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: "clear" | "attention" | "critical";
  title: string;
  detail: string;
}) => {
  const styles = {
    clear: "text-success border-success/30 bg-success/5",
    attention: "text-warning border-warning/30 bg-warning/5",
    critical: "text-destructive border-destructive/30 bg-destructive/5",
  }[tone];

  return (
    <div className="flex items-center gap-3 p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${styles}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone?: "neutral" | "attention" | "critical";
  loading: boolean;
}) => {
  const styles = {
    neutral: "border-border/80 bg-background",
    attention: "border-l-4 border-warning/80 bg-warning/5",
    critical: "border-l-4 border-destructive/80 bg-destructive/5",
  }[tone];

  return (
    <div className={`min-w-0 border p-4 ${styles}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{label}</span>
        <Icon className={`h-4 w-4 shrink-0 ${tone === "critical" ? "text-destructive" : tone === "attention" ? "text-warning" : "text-primary"}`} />
      </div>
      <p className="mt-4 text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{loading ? "..." : value}</p>
    </div>
  );
};

const CompactMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{value}</span>
  </div>
);

const SnapshotRow = ({ label, value }: { label: string; value: number | string }) => (
  <div className="flex items-center justify-between border border-border/70 px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
      {value}
    </span>
  </div>
);

export default AdminAnalytics;
