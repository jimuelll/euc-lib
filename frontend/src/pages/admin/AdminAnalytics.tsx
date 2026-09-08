import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, BookCopy, BookMarked, Check, CheckCircle2, Coins, Copy, DoorOpen, Globe2, RefreshCcw, Sparkles } from "lucide-react";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";
import { createAiAnalyticsReport, fetchAdminDashboard, type AiAnalyticsReportResponse } from "./adminAnalytics.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage } from "./components/AdminPage";

export interface DashboardStats {
  total_books: number; total_book_copies: number; available_book_copies: number; borrowed_book_copies: number;
  damaged_book_copies: number; lost_book_copies: number; active_users: number; total_users: number;
  active_borrowings: number; overdue_borrowings: number; borrowings_today: number; returns_today: number;
  active_reservations: number; ready_reservations: number; reservations_today: number; fulfilled_reservations_today: number;
  attendance_today: number; borrowing_attendance_today: number; entry_exit_attendance_today: number;
  unique_visitors_today: number; visit_hits_today: number; total_unique_visitors: number; total_visit_hits: number;
  active_notifications: number; active_subscriptions: number; upcoming_holidays: number; settled_fines_total: number;
  overdue_fine_per_hour: number; outstanding_fines: number;
}
export interface NamedValue { name: string; value: number }
export interface TrendPoint {
  label: string; unique_visitors?: number; visit_hits?: number; borrowed_count?: number; returned_count?: number;
  entry_exit_count?: number; borrowing_count?: number; created_count?: number; fulfilled_count?: number;
  cancelled_count?: number; settled_amount?: number;
}
export interface PopularBookPoint { name: string; total: number }
export interface CategoryPoint { name: string; titles: number; copies: number }
export interface DashboardResponse {
  stats: DashboardStats;
  charts: {
    visitTrend: TrendPoint[]; circulationTrend: TrendPoint[]; attendanceTrend: TrendPoint[]; reservationTrend: TrendPoint[];
    borrowingStatus: NamedValue[]; reservationStatus: NamedValue[]; userRoles: NamedValue[]; popularBooks: PopularBookPoint[];
    catalogByCategory: CategoryPoint[]; copyCondition: NamedValue[]; borrowingByRole: NamedValue[]; fineCollectionTrend: TrendPoint[];
  };
}

const emptyStats = Object.fromEntries([
  "total_books", "total_book_copies", "available_book_copies", "borrowed_book_copies", "damaged_book_copies", "lost_book_copies",
  "active_users", "total_users", "active_borrowings", "overdue_borrowings", "borrowings_today", "returns_today", "active_reservations",
  "ready_reservations", "reservations_today", "fulfilled_reservations_today", "attendance_today", "borrowing_attendance_today",
  "entry_exit_attendance_today", "unique_visitors_today", "visit_hits_today", "total_unique_visitors", "total_visit_hits",
  "active_notifications", "active_subscriptions", "upcoming_holidays", "settled_fines_total", "overdue_fine_per_hour", "outstanding_fines",
].map((key) => [key, 0])) as unknown as DashboardStats;
const emptyData: DashboardResponse = { stats: emptyStats, charts: { visitTrend: [], circulationTrend: [], attendanceTrend: [], reservationTrend: [], borrowingStatus: [], reservationStatus: [], userRoles: [], popularBooks: [], catalogByCategory: [], copyCondition: [], borrowingByRole: [], fineCollectionTrend: [] } };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
const chartPalette = ["#800000", "#b45309", "#0f766e", "#1d4ed8", "#6d28d9", "#be185d"];
export type AnalyticsRange = "7d" | "30d" | "month" | "year";
const RANGE_OPTIONS: { value: AnalyticsRange; label: string; shortLabel: string }[] = [
  { value: "7d", label: "Last 7 days", shortLabel: "7 days" }, { value: "30d", label: "Last 30 days", shortLabel: "30 days" },
  { value: "month", label: "This month", shortLabel: "Month" }, { value: "year", label: "This year", shortLabel: "Year" },
];
const dateForInput = (date: Date) => { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); };
const reportDatesFor = (range: AnalyticsRange) => {
  const today = new Date(); const end = dateForInput(today);
  if (range === "month") return { dateFrom: `${end.slice(0, 8)}01`, dateTo: end };
  if (range === "year") return { dateFrom: `${end.slice(0, 4)}-01-01`, dateTo: end };
  const start = new Date(today); start.setDate(start.getDate() - (range === "30d" ? 29 : 6));
  return { dateFrom: dateForInput(start), dateTo: end };
};
const reportDateFormatter = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
const formatReportDate = (value: string) => reportDateFormatter.format(new Date(`${value}T00:00:00`));
const formatReportPeriod = (dateFrom: string, dateTo: string) => `${formatReportDate(dateFrom)} – ${formatReportDate(dateTo)}`;
const sum = (items: TrendPoint[], key: keyof TrendPoint) => items.reduce((total, item) => total + Number(item[key] || 0), 0);

const AdminAnalytics = () => {
  const [data, setData] = useState<DashboardResponse>(emptyData);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const [range, setRange] = useState<AnalyticsRange>("7d"); const [reportQuestion, setReportQuestion] = useState("");
  const [report, setReport] = useState<AiAnalyticsReportResponse | null>(null); const [reportLoading, setReportLoading] = useState(false);
  const [answeredQuestion, setAnsweredQuestion] = useState("");
  const [reportError, setReportError] = useState(""); const [reportPrivacyNotice, setReportPrivacyNotice] = useState(false); const [copied, setCopied] = useState(false);
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Selected period";
  const reportDates = useMemo(() => reportDatesFor(range), [range]);
  const performance = useMemo(() => ({
    borrowed: sum(data.charts.circulationTrend, "borrowed_count"), returned: sum(data.charts.circulationTrend, "returned_count"),
    attendance: sum(data.charts.attendanceTrend, "entry_exit_count") + sum(data.charts.attendanceTrend, "borrowing_count"),
    visitors: sum(data.charts.visitTrend, "unique_visitors"),
  }), [data]);
  const loadDashboard = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    mode === "initial" ? setLoading(true) : setRefreshing(true); setError("");
    try { setData(await fetchAdminDashboard(range)); } catch (loadError: unknown) { setError(getApiErrorMessage(loadError, "Failed to load analytics.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => { setReport(null); setAnsweredQuestion(""); setReportError(""); setReportPrivacyNotice(false); }, [range]);
  const generateReport = async () => {
    const question = reportQuestion.trim();
    setReportLoading(true); setReport(null); setAnsweredQuestion(""); setReportError(""); setReportPrivacyNotice(false); setCopied(false);
    try {
      const nextReport = await createAiAnalyticsReport({ ...reportDates, question: question || undefined });
      setReport(nextReport);
      setAnsweredQuestion(nextReport.mode === "answer" ? question : "");
    } catch (reportFailure: unknown) {
      setReportPrivacyNotice(getApiErrorCode(reportFailure) === "AI_REPORT_PRIVACY_RESTRICTED");
      setReportError(getApiErrorMessage(reportFailure, "Unable to generate the performance brief. Try again."));
    }
    finally { setReportLoading(false); }
  };
  const copyReport = async () => {
    if (!report) return;
    const period = formatReportPeriod(report.range.dateFrom, report.range.dateTo);
    const copyText = report.mode === "answer"
      ? [`Library analytics answer`, `Question: ${answeredQuestion}`, `Answer: ${report.report}`, `Period: ${period}`, "Source: Aggregate library operations data for this period."].join("\n")
      : [`Library performance brief`, `Period: ${period}`, "", report.report, "", "Source: Aggregate library operations data for this period."].join("\n");
    try { await navigator.clipboard.writeText(copyText); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setReportPrivacyNotice(false); setReportError("Unable to copy the result. Select the text and copy it manually."); }
  };

  return <AdminPage title="Operations Analytics" actions={<Button type="button" variant="outline" className="rounded-none" onClick={() => void loadDashboard("refresh")} disabled={loading || refreshing}><RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button>}>
    <section className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl"><h2 className="text-lg font-semibold text-foreground">How did the library perform?</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Choose one period. Performance views update together; inventory snapshots remain current.</p></div>
      <div className="flex w-full overflow-x-auto border border-border bg-card p-1 lg:w-auto" role="group" aria-label="Analytics period">{RANGE_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setRange(option.value)} className={`min-h-9 shrink-0 px-4 text-sm font-semibold transition-colors ${range === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`} aria-pressed={range === option.value}>{option.shortLabel}</button>)}</div>
    </section>
    {error ? <div role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    <Tabs defaultValue="overview" className="space-y-5">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0">{["overview", "circulation", "visitors", "collection"].map((tab) => <TabsTrigger key={tab} value={tab} className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-5 capitalize shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">{tab}</TabsTrigger>)}</TabsList>

      <TabsContent value="overview" className="mt-0 space-y-5">
        <div className="grid border border-border/80 bg-card sm:grid-cols-2 xl:grid-cols-4">
          <PerformanceMetric label="Borrowed" value={performance.borrowed} icon={BookCopy} loading={loading} period={rangeLabel} />
          <PerformanceMetric label="Returned" value={performance.returned} icon={CheckCircle2} loading={loading} period={rangeLabel} />
          <PerformanceMetric label="Library scans" value={performance.attendance} icon={DoorOpen} loading={loading} period={rangeLabel} />
          <PerformanceMetric label="Site visitors" value={performance.visitors} icon={Globe2} loading={loading} period={rangeLabel} />
        </div>
        <section className="overflow-hidden border border-primary/30 bg-card">
          <div className="grid lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
            <div className="bg-primary px-5 py-6 text-primary-foreground sm:px-7 sm:py-8">
              <div className="flex h-10 w-10 items-center justify-center border border-primary-foreground/25 bg-primary-foreground/10"><Sparkles className="h-5 w-5 text-warning" /></div>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.025em]">Ask or summarize</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/80">Ask one question for a focused answer, or leave it blank for a full performance summary.</p>
              <div className="mt-7 space-y-2">
                <label htmlFor="analytics-focus" className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/75">Question <span className="normal-case tracking-normal">(optional)</span></label>
                <Input id="analytics-focus" value={reportQuestion} maxLength={500} onChange={(event) => setReportQuestion(event.target.value)} placeholder="Example: How many people visited on Sept. 7?" className="h-12 rounded-none border-primary-foreground/30 bg-primary-foreground/10 px-4 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/70" />
                <p className="text-xs leading-5 text-primary-foreground/70">Uses aggregate data from {rangeLabel.toLowerCase()} only.</p>
              </div>
              <Button type="button" variant="secondary" className="mt-5 h-12 w-full rounded-none font-semibold" onClick={() => void generateReport()} disabled={reportLoading}>{reportLoading ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{reportLoading ? "Analyzing…" : reportQuestion.trim() ? "Answer question" : "Generate summary"}</Button>
            </div>

            <div className="relative min-h-[320px] bg-[linear-gradient(145deg,hsl(var(--primary)/0.055),transparent_52%)] px-5 py-6 sm:px-8 sm:py-8">
              {reportError ? <div role="alert" className={`mb-5 flex items-start gap-3 border px-4 py-4 ${reportPrivacyNotice ? "border-warning/40 bg-warning/10 text-foreground" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${reportPrivacyNotice ? "text-warning" : "text-destructive"}`} />
                <div><p className="text-sm font-semibold">{reportPrivacyNotice ? "Privacy-protected request" : "Unable to generate report"}</p><p className={`mt-1 text-sm leading-6 ${reportPrivacyNotice ? "text-muted-foreground" : "text-destructive"}`}>{reportError}</p></div>
              </div> : null}
              {report ? <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{report.mode === "answer" ? "Library analytics answer" : "Performance brief"}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{formatReportPeriod(report.range.dateFrom, report.range.dateTo)}{report.mode === "summary" ? ` · compared with the previous ${report.range.days} days` : ""}</p>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="rounded-none" onClick={() => void copyReport()}>{copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copied ? "Copied" : report.mode === "answer" ? "Copy answer" : "Copy brief"}</Button>
                </div>

                {report.mode === "answer" ? <div className="flex flex-1 flex-col justify-center py-7 sm:py-10">
                  <p className="max-w-[70ch] text-sm leading-6 text-muted-foreground">{answeredQuestion}</p>
                  <ReportNarrative text={report.report} mode="answer" />
                </div> : <ReportNarrative text={report.report} mode="summary" />}

                <div className="mt-auto flex flex-col gap-1 border-t border-border/70 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>Based on aggregate library operations data</span>
                  <span className="tabular-nums">{report.range.days} {report.range.days === 1 ? "day" : "days"} analyzed</span>
                </div>
              </div> : <div className="flex h-full min-h-[260px] max-w-xl flex-col justify-center">
                <div className="flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">A clearer answer, grounded in your data</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask about a specific date, title, visitor count, or activity. Every answer stays within the selected reporting period.</p>
                <p className="mt-6 text-sm font-medium text-foreground">Ready for {formatReportPeriod(reportDates.dateFrom, reportDates.dateTo)}</p>
              </div>}
            </div>
          </div>
        </section>
        <AnalyticsPanel title="Current operational position" description="Today’s carryover items, kept separate from period performance."><div className="grid divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0"><PositionItem icon={data.stats.overdue_borrowings ? AlertTriangle : CheckCircle2} label="Overdue loans" value={data.stats.overdue_borrowings} tone={data.stats.overdue_borrowings ? "critical" : "clear"} /><PositionItem icon={BookMarked} label="Ready reservations" value={data.stats.ready_reservations} tone={data.stats.ready_reservations ? "attention" : "clear"} /><PositionItem icon={Coins} label="Outstanding fines" value={money.format(data.stats.outstanding_fines)} tone={data.stats.outstanding_fines ? "attention" : "clear"} /></div></AnalyticsPanel>
      </TabsContent>

      <TabsContent value="circulation" className="mt-0 space-y-5"><SectionIntro title="Circulation performance" description={`Borrowing and reservation movement for ${rangeLabel.toLowerCase()}.`} /><div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Borrowed and returned" description="Daily circulation volume"><ChartContainer className="h-[280px] w-full" config={{ borrowed_count: { label: "Borrowed", color: "#800000" }, returned_count: { label: "Returned", color: "#0f766e" } }}><BarChart data={data.charts.circulationTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="borrowed_count" fill="var(--color-borrowed_count)" radius={[2, 2, 0, 0]} /><Bar dataKey="returned_count" fill="var(--color-returned_count)" radius={[2, 2, 0, 0]} /></BarChart></ChartContainer></AnalyticsPanel>
        <AnalyticsPanel title="Reservation outcomes" description="Created, fulfilled, and cancelled"><ChartContainer className="h-[280px] w-full" config={{ created_count: { label: "Created", color: "#800000" }, fulfilled_count: { label: "Fulfilled", color: "#0f766e" }, cancelled_count: { label: "Cancelled", color: "#b45309" } }}><LineChart data={data.charts.reservationTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Line type="monotone" dataKey="created_count" stroke="var(--color-created_count)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="fulfilled_count" stroke="var(--color-fulfilled_count)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="cancelled_count" stroke="var(--color-cancelled_count)" strokeWidth={2} dot={false} /></LineChart></ChartContainer></AnalyticsPanel>
      </div><div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><AnalyticsPanel title="Current loan status"><DistributionList items={data.charts.borrowingStatus} /></AnalyticsPanel><AnalyticsPanel title="Most borrowed titles"><RankedList items={data.charts.popularBooks.map((item) => ({ label: item.name, value: item.total }))} emptyText="No borrowing history yet." /></AnalyticsPanel></div></TabsContent>

      <TabsContent value="visitors" className="mt-0 space-y-5"><SectionIntro title="Visitor and engagement activity" description={`Physical visits, borrowing scans, and website usage for ${rangeLabel.toLowerCase()}.`} /><div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Library attendance" description="Entry/exit and borrowing-purpose scans"><ChartContainer className="h-[280px] w-full" config={{ entry_exit_count: { label: "Entry / exit", color: "#800000" }, borrowing_count: { label: "Borrowing", color: "#0f766e" } }}><LineChart data={data.charts.attendanceTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Line type="monotone" dataKey="entry_exit_count" stroke="var(--color-entry_exit_count)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="borrowing_count" stroke="var(--color-borrowing_count)" strokeWidth={2} dot={false} /></LineChart></ChartContainer></AnalyticsPanel>
        <AnalyticsPanel title="Website activity" description="Unique visitors and tracked page hits"><ChartContainer className="h-[280px] w-full" config={{ unique_visitors: { label: "Unique visitors", color: "#800000" }, visit_hits: { label: "Page hits", color: "#b45309" } }}><LineChart data={data.charts.visitTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Line type="monotone" dataKey="unique_visitors" stroke="var(--color-unique_visitors)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="visit_hits" stroke="var(--color-visit_hits)" strokeWidth={2} dot={false} /></LineChart></ChartContainer></AnalyticsPanel>
      </div><div className="grid gap-5 xl:grid-cols-2"><AnalyticsPanel title="User role distribution"><DistributionList items={data.charts.userRoles} /></AnalyticsPanel><AnalyticsPanel title="Fine collections" description="Settled payments over the latest six months"><ChartContainer className="h-[250px] w-full" config={{ settled_amount: { label: "Settled fines", color: "#0f766e" } }}><LineChart data={data.charts.fineCollectionTrend}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} /><YAxis tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => money.format(Number(value || 0))} />} /><Line type="monotone" dataKey="settled_amount" stroke="var(--color-settled_amount)" strokeWidth={2} dot={false} /></LineChart></ChartContainer></AnalyticsPanel></div></TabsContent>

      <TabsContent value="collection" className="mt-0 space-y-5"><SectionIntro title="Collection performance" description="Inventory composition, condition, and who the collection is serving." /><div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Catalog by category" description="Titles and physical copies"><ChartContainer className="h-[310px] w-full" config={{ titles: { label: "Titles", color: "#800000" }, copies: { label: "Copies", color: "#b45309" } }}><BarChart data={data.charts.catalogByCategory} layout="vertical" margin={{ left: 12, right: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="titles" fill="var(--color-titles)" radius={[0, 2, 2, 0]} /><Bar dataKey="copies" fill="var(--color-copies)" radius={[0, 2, 2, 0]} /></BarChart></ChartContainer></AnalyticsPanel>
        <AnalyticsPanel title="Physical copy condition"><div className="grid items-center gap-5 sm:grid-cols-[1fr_0.8fr]"><ChartContainer className="mx-auto h-[260px] w-full max-w-[300px]" config={{ value: { label: "Copies", color: "#800000" } }}><PieChart><ChartTooltip content={<ChartTooltipContent />} /><Pie data={data.charts.copyCondition} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>{data.charts.copyCondition.map((item, index) => <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />)}</Pie></PieChart></ChartContainer><DistributionList items={data.charts.copyCondition} /></div></AnalyticsPanel>
      </div><div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><AnalyticsPanel title="Borrowing demand by role"><DistributionList items={data.charts.borrowingByRole} /></AnalyticsPanel><AnalyticsPanel title="Collection snapshot"><div className="divide-y divide-border/70"><SnapshotRow label="Catalog titles" value={data.stats.total_books} /><SnapshotRow label="Active copies" value={data.stats.total_book_copies} /><SnapshotRow label="Available" value={data.stats.available_book_copies} /><SnapshotRow label="Damaged" value={data.stats.damaged_book_copies} /><SnapshotRow label="Lost" value={data.stats.lost_book_copies} /></div></AnalyticsPanel></div></TabsContent>
    </Tabs>
  </AdminPage>;
};

const AnalyticsPanel = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => <section className="min-w-0 border border-border/80 bg-card"><header className="border-b border-border/70 px-5 py-4"><h2 className="font-semibold text-foreground">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</header><div className="p-5">{children}</div></section>;
const SectionIntro = ({ title, description }: { title: string; description: string }) => <div><h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
const PerformanceMetric = ({ label, value, icon: Icon, loading, period }: { label: string; value: number; icon: ComponentType<{ className?: string }>; loading: boolean; period: string }) => <div className="border-b border-border/70 p-5 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{loading ? "—" : value.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{period}</p></div>;
const PositionItem = ({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: number | string; tone: "clear" | "attention" | "critical" }) => { const styles = tone === "critical" ? "text-destructive" : tone === "attention" ? "text-warning" : "text-success"; return <div className="flex items-center gap-4 p-5"><Icon className={`h-5 w-5 shrink-0 ${styles}`} /><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p></div></div>; };
const ReportNarrative = ({ text, mode }: { text: string; mode: "answer" | "summary" }) => mode === "answer" ? <p className="mt-4 max-w-[38ch] whitespace-pre-line text-2xl font-semibold leading-9 tracking-[-0.025em] text-foreground sm:text-3xl sm:leading-10">{text}</p> : <div className="mt-6 space-y-5">{text.split(/\n\s*\n/).filter(Boolean).map((block, index) => { const [first, ...rest] = block.split("\n"); const isHeading = /^(Performance assessment|What changed|Recommended follow-up):?$/i.test(first.trim()); return <div key={`${first}-${index}`}>{isHeading ? <h3 className="text-sm font-semibold text-primary">{first.replace(/:$/, "")}</h3> : null}<p className={`${isHeading ? "mt-1.5" : ""} max-w-[70ch] whitespace-pre-line text-sm leading-6 text-foreground`}>{isHeading ? rest.join("\n") : block}</p></div>; })}</div>;
const DistributionList = ({ items }: { items: NamedValue[] }) => items.length ? <div className="space-y-3">{items.map((item, index) => { const max = Math.max(...items.map((entry) => entry.value), 1); return <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-4"><span className="text-sm capitalize text-foreground">{item.name.replace(/_/g, " ")}</span><span className="text-sm font-semibold tabular-nums text-foreground">{item.value}</span></div><div className="h-1.5 bg-muted"><div className="h-full" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 3 : 0)}%`, backgroundColor: chartPalette[index % chartPalette.length] }} /></div></div>; })}</div> : <p className="text-sm text-muted-foreground">No data for this period.</p>;
const RankedList = ({ items, emptyText }: { items: { label: string; value: number | string }[]; emptyText: string }) => items.length ? <ol className="divide-y divide-border/70">{items.map((item, index) => <li key={item.label} className="flex items-center gap-4 py-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-foreground" title={item.label}>{item.label}</span><span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{item.value}</span></li>)}</ol> : <p className="text-sm text-muted-foreground">{emptyText}</p>;
const SnapshotRow = ({ label, value }: { label: string; value: number | string }) => <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm text-muted-foreground">{label}</span><span className="font-semibold tabular-nums text-foreground">{value}</span></div>;

export default AdminAnalytics;
