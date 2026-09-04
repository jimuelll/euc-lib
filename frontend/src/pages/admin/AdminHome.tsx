import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ArrowRightLeft, BookMarked, CheckCircle2, ClipboardList, RefreshCcw, Users } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { ContentRowsSkeleton } from "@/components/ui/content-skeletons";

interface DashboardStats { total_books: number; available_book_copies: number; borrowed_book_copies: number; active_users: number; overdue_borrowings: number; borrowings_today: number; returns_today: number; ready_reservations: number; reservations_today: number; attendance_today: number; damaged_book_copies: number; lost_book_copies: number; active_notifications: number; active_subscriptions: number; upcoming_holidays: number; outstanding_fines: number; }
interface RecentActivity { occurred_at: string; activity_type: "borrowed" | "returned" | "reserved"; description: string; }
interface DashboardResponse { stats: DashboardStats; recentActivity: RecentActivity[]; }
type AttentionItem = { label: string; detail: string; href: string; status: "urgent" | "attention" | "clear"; value: string };

const emptyStats: DashboardStats = { total_books: 0, available_book_copies: 0, borrowed_book_copies: 0, active_users: 0, overdue_borrowings: 0, borrowings_today: 0, returns_today: 0, ready_reservations: 0, reservations_today: 0, attendance_today: 0, damaged_book_copies: 0, lost_book_copies: 0, active_notifications: 0, active_subscriptions: 0, upcoming_holidays: 0, outstanding_fines: 0 };
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const load = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.get<DashboardResponse>("/api/admin/dashboard");
      setStats(response.data.stats);
      setActivity(response.data.recentActivity ?? []);
      setUpdatedAt(new Date());
      setHasLoadedData(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message ?? "Couldn’t update the desk. Try refreshing again.");
    } finally {
      refresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const attentionItems = useMemo<AttentionItem[]>(() => [
    { label: "Overdue returns", detail: stats.overdue_borrowings ? "Resolve these loans before completing clearance." : "All active loans are within their due date.", href: "/admin/clearance?review=queue", status: stats.overdue_borrowings ? "urgent" : "clear", value: String(stats.overdue_borrowings) },
    { label: "Unpaid fines", detail: stats.outstanding_fines ? "Settlements are recorded through clearance." : "No balances are waiting for settlement.", href: "/admin/clearance?review=queue", status: stats.outstanding_fines ? "urgent" : "clear", value: currency.format(stats.outstanding_fines) },
    { label: "Ready reservations", detail: stats.ready_reservations ? "Items are waiting for collection at the desk." : "No reservations are awaiting pickup.", href: "/admin/reservations", status: stats.ready_reservations ? "attention" : "clear", value: String(stats.ready_reservations) },
  ], [stats]);
  const primaryAttention = attentionItems.find((item) => item.status === "urgent") ?? attentionItems.find((item) => item.status === "attention");
  const primaryRoute = primaryAttention?.href ?? "/admin/circulation";
  const primaryLabel = primaryAttention ? `Review ${primaryAttention.label.toLowerCase()}` : "Open circulation";
  const primaryDetail = primaryAttention ? primaryAttention.detail : "Borrow, return, renew, or record a desk transaction.";
  const deskMetrics = [{ label: "Borrowings", value: stats.borrowings_today, href: "/admin/circulation" }, { label: "Returns", value: stats.returns_today, href: "/admin/circulation" }, { label: "New reservations", value: stats.reservations_today, href: "/admin/reservations" }, { label: "Attendance", value: stats.attendance_today }];
  const healthMetrics = [{ label: "Catalog titles", value: stats.total_books }, { label: "Available copies", value: stats.available_book_copies }, { label: "Items on loan", value: stats.borrowed_book_copies }, { label: "Active users", value: stats.active_users }, { label: "Damaged copies", value: stats.damaged_book_copies }, { label: "Lost copies", value: stats.lost_book_copies }, { label: "Active subscriptions", value: stats.active_subscriptions }, { label: "Upcoming holidays", value: stats.upcoming_holidays }, { label: "Active notifications", value: stats.active_notifications }];

  return <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-10">
    <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>Dashboard</h1><p className="mt-2 text-sm text-muted-foreground">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : " · Loading desk status"}</p></div>
      <Button type="button" variant="outline" className="self-start rounded-none lg:self-auto" onClick={() => void load(true)} disabled={loading || refreshing}><RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh desk</Button>
    </header>
    <div aria-live="polite" className="sr-only">{refreshing ? "Refreshing dashboard data." : updatedAt ? `Dashboard updated at ${updatedAt.toLocaleTimeString()}.` : ""}</div>
    {error ? <div role="alert" className="flex flex-col gap-3 border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><Button type="button" variant="outline" size="sm" className="w-fit rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void load(true)}>Try again</Button></div> : null}
    {!hasLoadedData ? (
      <section className="border border-border bg-card px-5 py-12 text-center" aria-live="polite">
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{loading ? "Loading desk status" : "Desk data unavailable"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{loading ? "Gathering the current circulation, reservations, and clearance status." : "The dashboard will show priorities once it can retrieve current library data."}</p>
      </section>
    ) : (
      <>
    <section className="border border-border bg-card" aria-labelledby="attention-heading"><SectionHeading id="attention-heading" title="Needs attention" /><div className="grid xl:grid-cols-[minmax(0,1fr)_20rem]"><div className="divide-y divide-border xl:grid xl:grid-cols-3 xl:divide-x xl:divide-y-0">{attentionItems.map((item) => <AttentionRow key={item.label} item={item} loading={loading} />)}</div><Link to={primaryRoute} className="group flex min-h-44 flex-col justify-between bg-primary p-5 text-primary-foreground transition-colors hover:bg-primary/90 xl:min-h-0"><span className="flex h-10 w-10 items-center justify-center border border-primary-foreground/50"><ArrowRightLeft className="h-5 w-5" /></span><span><span className="block text-xl font-semibold tracking-[-0.02em]" style={{ fontFamily: "var(--font-heading)" }}>{primaryLabel}</span><span className="mt-2 block max-w-[28ch] text-sm leading-5 text-primary-foreground/80">{primaryDetail}</span></span><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link></div></section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]"><section className="border border-border bg-card" aria-labelledby="desk-heading"><SectionHeading id="desk-heading" title="Today at the desk" /><div className="grid border-b border-border sm:grid-cols-4">{deskMetrics.map((metric) => <DeskMetric key={metric.label} {...metric} loading={loading} />)}</div><RecentActivity activity={activity} loading={loading} /></section><section className="border border-border bg-card" aria-labelledby="actions-heading"><SectionHeading id="actions-heading" title="Start a task" /><nav aria-label="Common desk tasks" className="divide-y divide-border"><TaskLink href="/admin/circulation" icon={ArrowRightLeft} label="Borrow or return" detail="Open the circulation desk" /><TaskLink href="/admin/clearance" icon={ClipboardList} label="Open clearance" detail="Review loans and fine settlements" /><TaskLink href="/admin/reservations" icon={BookMarked} label="Manage reservations" detail="Prepare and release holds" /><TaskLink href="/admin/manage" icon={Users} label="User records" detail="Find and manage library accounts" /></nav></section></div>

    <details className="group border border-border bg-card"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden"><span><span className="block text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Library health</span><span className="mt-1 block text-sm text-muted-foreground">Reference metrics for the collection, services, and administration.</span></span><span className="text-sm font-semibold text-warning group-open:hidden">Show reference metrics</span><span className="hidden text-sm font-semibold text-warning group-open:inline">Hide reference metrics</span></summary><div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">{healthMetrics.map((metric) => <div key={metric.label} className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-3"><span className="text-sm text-muted-foreground">{metric.label}</span><span className="font-mono text-sm font-semibold text-foreground">{loading ? "…" : metric.value}</span></div>)}</div></details>
      </>
    )}
  </main>;
}

function SectionHeading({ id, title, detail }: { id: string; title: string; detail?: string }) { return <header className="border-b border-border px-5 py-4"><h2 id={id} className="text-lg font-semibold tracking-[-0.02em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>{detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}</header>; }
function AttentionRow({ item, loading }: { item: AttentionItem; loading: boolean }) { const Icon = item.status === "urgent" ? AlertTriangle : item.status === "attention" ? BookMarked : CheckCircle2; const statusLabel = item.status === "urgent" ? "Urgent" : item.status === "attention" ? "Needs pickup" : "Clear"; const tone = item.status === "urgent" ? "bg-destructive text-destructive-foreground" : item.status === "attention" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"; return <Link to={item.href} className="group block p-5 transition-colors hover:bg-muted/40"><span className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${tone}`}><Icon className="h-3.5 w-3.5" />{statusLabel}</span><span className="mt-4 block font-mono text-2xl font-semibold tracking-[-0.04em] text-foreground">{loading ? "…" : item.value}</span><span className="mt-1 block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-2 block min-h-9 text-sm leading-5 text-muted-foreground">{item.detail}</span><span className="mt-4 inline-flex items-center gap-2 border border-warning bg-warning px-3 py-2 text-sm font-semibold text-warning-foreground transition-colors group-hover:bg-warning/90">Review <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link>; }
function DeskMetric({ label, value, href, loading }: { label: string; value: number; href?: string; loading: boolean }) { const content = <><span className="block text-sm text-muted-foreground">{label}</span><span className="mt-2 block font-mono text-xl font-semibold tracking-[-0.03em] text-foreground">{loading ? "…" : value}</span></>; return href ? <Link to={href} className="border-b border-border px-5 py-4 transition-colors hover:bg-muted/40 sm:border-b-0 sm:border-r sm:last:border-r-0">{content}</Link> : <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:last:border-r-0">{content}</div>; }
function RecentActivity({ activity, loading }: { activity: RecentActivity[]; loading: boolean }) { if (loading) return <div className="px-5 py-5"><ContentRowsSkeleton rows={4} /></div>; if (!activity.length) return <div className="px-5 py-10"><p className="text-base font-semibold text-foreground">No transactions recorded yet.</p><Link to="/admin/circulation" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-warning">Open circulation to start a desk transaction <ArrowRight className="h-4 w-4" /></Link></div>; return <div className="divide-y divide-border">{activity.slice(0, 6).map((item, index) => <div key={`${item.occurred_at}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 px-5 py-3.5"><span className="font-mono text-xs font-semibold text-warning">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-5 text-foreground">{item.description}</p><time className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(item.occurred_at)}</time></div>)}<Link to="/admin/circulation" className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-warning transition-colors hover:bg-muted/40">View circulation history <ArrowRight className="h-4 w-4" /></Link></div>; }
function TaskLink({ href, icon: Icon, label, detail }: { href: string; icon: typeof ArrowRightLeft; label: string; detail: string }) { return <Link to={href} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"><Icon className="h-4 w-4 shrink-0 text-warning" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" /></Link>; }
function formatTime(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
