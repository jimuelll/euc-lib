import {ModerationAttention} from "@/features/moderation";
import { AdminPageHeader, AdminSummaryTile } from "../components/AdminDeskSystem";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryShelf } from "@/components/ui/library-patterns";
import { useAuth } from "@/context/AuthContext";
import { fetchAdminDashboard, type DashboardStats, type RecentActivity } from "@/features/admin/api";
import { AdminIcon, type AdminIconName } from "../components/AdminIcon";
import { CompactAction, CompactMetric, CompactPanel, CompactTextLink } from "../components/CompactAdmin";
import { canAccessItem, allSidebarItems } from "../layout/AdminLayoutData";
import "../compact-admin.css";

const shortDate = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

export default function Dashboard() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["analytics", "desk"], queryFn: ({ signal }) => fetchAdminDashboard(signal) });
  const updatedAt = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null;
  const refresh = () => void query.refetch();
  const quickLinks = [
    { href: "/admin/manage", label: "Users", icon: "users" as const },
    { href: "/admin/catalog?filter=needs-holdings", label: "Needs holdings", icon: "catalog" as const },
    { href: "/admin/reservations", label: "Reservations", icon: "reservations" as const },
    { href: "/admin/query", label: "Reports", icon: "reports" as const },
  ].filter(link => {
    const item = allSidebarItems.find(item => item.url === link.href.split("?")[0]);
    return item && canAccessItem(item, user?.role);
  });

  return <div className="admin-dashboard">
    <AdminPageHeader title="Dashboard" subtitle={<time dateTime={new Date().toISOString()}>{shortDate.format(new Date())}</time>} updatedAt={query.dataUpdatedAt} loading={query.isFetching} onRefresh={refresh} />

    <ModerationAttention/>
    <nav aria-label="Circulation actions" className="admin-dashboard-actions">
      <CompactAction href="/admin/circulation?tab=transaction&mode=borrow" icon="borrow" primary>Borrow a copy</CompactAction>
      <CompactAction href="/admin/circulation?tab=transaction&mode=return" icon="return">Return a copy</CompactAction>
      <CompactAction href="/admin/reservations" icon="reservations">Reservations</CompactAction>
    </nav>
    <div aria-live="polite" className="sr-only">{query.isFetching ? "Refreshing dashboard data." : updatedAt ? `Dashboard updated at ${shortTime.format(updatedAt)}.` : ""}</div>

    {query.isError && <div role="alert" className="admin-dashboard-error">
      <AdminIcon name="warning" /><span>{query.data ? "Couldn’t refresh the dashboard. Showing the last available data." : "Couldn’t load the dashboard. Try again."}</span>
      <Button type="button" variant="outline" className="admin-compact-button" disabled={query.isFetching} onClick={refresh}>Try again</Button>
    </div>}
    {query.data ? <>
      <OutstandingItems stats={query.data.stats} />
      <CompactPanel title="Today’s totals" id="today-totals-heading">
        <div className="admin-dashboard-totals">
          <CompactMetric label="Borrowings" value={query.data.stats.borrowings_today} icon="borrow" tone="borrowed" href="/admin/circulation?tab=history" />
          <CompactMetric label="Returns" value={query.data.stats.returns_today} icon="return" tone="returned" href="/admin/circulation?tab=history" />
          <CompactMetric label="New reservations" value={query.data.stats.reservations_today} icon="reservations" tone="reserved" href="/admin/reservations" />
          <CompactMetric label="Attendance" value={query.data.stats.attendance_today} icon="attendanceActivity" tone="attendance" />
        </div>
      </CompactPanel>
      <div className="admin-dashboard-lower-grid">
        <CompactPanel title="Recent transactions" id="recent-transactions-heading" actions={<CompactTextLink href="/admin/circulation?tab=history">View history</CompactTextLink>}>
          <TransactionList activity={query.data.recentActivity} />
        </CompactPanel>
        <CompactPanel title="Quick links" id="quick-links-heading">
          <nav aria-label="Quick links" className="admin-dashboard-quick-links">
            {quickLinks.map(link => <Link key={link.href} to={link.href}><AdminIcon name={link.icon} /><span>{link.label}</span><AdminIcon name="arrowRight" /></Link>)}
          </nav>
        </CompactPanel>
      </div>
      <LibraryOverview stats={query.data.stats} />
    </> : query.isPending ? <DashboardSkeleton /> : <section className="admin-compact-panel admin-dashboard-unavailable" aria-labelledby="unavailable-heading">
      <h2 id="unavailable-heading">Dashboard data unavailable</h2><p>Refresh to load library totals and transactions.</p>
    </section>}
  </div>;
}

function OutstandingItems({ stats }: { stats: DashboardStats }) {
  return <CompactPanel title="Outstanding items" id="outstanding-items-heading" className="admin-dashboard-outstanding-panel"><LibraryShelf className="admin-dashboard-outstanding">
    <AdminSummaryTile label="Overdue loans" value={stats.overdue_borrowings} tone="red" icon="overdue" hint={stats.overdue_borrowings ? `View ${stats.overdue_borrowings.toLocaleString("en-PH")} loans` : "No overdue loans"} href="/admin/circulation?tab=history&filter=overdue" heading />
    <AdminSummaryTile label="Unpaid fines" value={stats.outstanding_fines} currency tone="red" icon="fines" hint="Review outstanding balances" href="/admin/clearance?tab=queue&filter=all" heading />
    <AdminSummaryTile label="Ready reservations" value={stats.ready_reservations} tone="green" icon="reservations" hint={stats.ready_reservations ? "Prepared holds awaiting pickup" : "Nothing waiting"} href="/admin/reservations?filter=ready" heading />
  </LibraryShelf></CompactPanel>;
}

function TransactionList({ activity }: { activity: RecentActivity[] }) {
  if (!activity.length) return <div className="admin-dashboard-empty"><AdminIcon name="transactions" /><div>
    <p>No recent transactions</p><CompactTextLink href="/admin/circulation">Open circulation</CompactTextLink>
  </div></div>;
  const icons: Record<RecentActivity["activity_type"], AdminIconName> = { borrowed: "borrow", returned: "return", reserved: "reservations" };
  return <ul className="admin-dashboard-transactions">{activity.slice(0, 6).map((item, index) => {
    const date = new Date(item.occurred_at);
    const validDate = !Number.isNaN(date.getTime());
    return <li key={`${item.occurred_at}-${index}`} data-tone={item.activity_type}>
      <AdminIcon name={icons[item.activity_type] ?? "transactions"} />
      <p><span className="sr-only">{item.activity_type}: </span>{item.description}</p>
      <time dateTime={validDate ? date.toISOString() : undefined}>{validDate ? date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time unavailable"}</time>
    </li>;
  })}</ul>;
}

function LibraryOverview({ stats }: { stats: DashboardStats }) {
  const metrics = [
    { label: "Catalog titles", value: stats.total_books }, { label: "Available to borrow", value: stats.available_book_copies },
    { label: "Items on loan", value: stats.borrowed_book_copies }, { label: "Active users", value: stats.active_users },
    { label: "Damaged copies", value: stats.damaged_book_copies }, { label: "Lost copies", value: stats.lost_book_copies },
    { label: "Active subscriptions", value: stats.active_subscriptions }, { label: "Upcoming holidays", value: stats.upcoming_holidays },
    { label: "Active notifications", value: stats.active_notifications },
  ];
  return <details className="admin-compact-panel admin-dashboard-overview">
    <summary><span>Library overview</span><AdminIcon name="chevronDown" /></summary>
    <dl>{metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value.toLocaleString("en-PH")}</dd></div>)}</dl>
  </details>;
}

function DashboardSkeleton() {
  return <div aria-label="Loading dashboard" aria-busy="true" className="admin-dashboard-loading">
    <div className="admin-compact-panel admin-dashboard-outstanding-panel"><div className="admin-compact-section-header"><Skeleton className="h-5 w-32" /></div><div className="admin-dashboard-outstanding">{Array.from({ length: 3 }, (_, index) => <div className="admin-compact-panel admin-dashboard-summary" data-tone="neutral" key={index}>
      <Skeleton className="size-10 shrink-0" /><div className="admin-dashboard-summary-copy"><Skeleton className="h-5 w-28 max-w-full" /><Skeleton className="mt-1 h-8 w-24 max-w-full" /></div>
    </div>)}</div></div>
    <div className="admin-compact-panel"><div className="admin-compact-section-header"><Skeleton className="h-5 w-28" /></div><div className="admin-dashboard-totals">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="admin-compact-metric"><Skeleton className="size-9 shrink-0 rounded-full" /><div><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-6 w-10" /></div></div>)}
    </div></div>
    <div className="admin-dashboard-lower-grid">{["transactions", "links"].map(panel => <div className="admin-compact-panel" key={panel}>
      <div className="admin-compact-section-header"><Skeleton className="h-5 w-36" /></div>
      {Array.from({ length: 3 }, (_, index) => <div className="flex items-center gap-3 border-b border-border p-4 last:border-0" key={index}><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-3/4" /></div>)}
    </div>)}</div>
    <div className="admin-compact-panel p-4"><Skeleton className="h-5 w-32" /></div>
  </div>;
}
