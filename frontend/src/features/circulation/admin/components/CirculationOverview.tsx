import { AdminSummaryTile, formatPeso, useAdminUrlState } from "@/features/admin";
import type { CirculationLogSummary } from "../circulation.api";
const money = (value: number) => formatPeso(value);
export default function CirculationOverview({ summary, loading }: { summary?: CirculationLogSummary; loading: boolean }) {
  const [params, patch] = useAdminUrlState();
  const oldest = summary?.oldest_overdue ? Math.max(1, Math.ceil((Date.now() - new Date(summary.oldest_overdue).getTime()) / 86_400_000)) : null;
  const tiles = [
    { label: "Overdue loans", icon: "overdue" as const, tone: "red", status: "overdue", value: summary?.overdue_count, detail: summary ? summary.overdue_count ? `${oldest ? `Oldest · ${oldest} days overdue · ` : ""}${summary.accrued_fines === undefined ? "Fine total unavailable" : money(summary.accrued_fines) + " accrued"}` : "No overdue loans" : "Loan totals unavailable" },
    { label: "Active loans", icon: "borrow" as const, tone: "blue", status: "borrowed", value: summary ? summary.borrowed_count : undefined, detail: summary?.due_soon_count === undefined ? "Due-soon total unavailable" : `${summary.due_soon_count} due within 24 hours` },
    { label: "Today's activity", icon: "clock" as const, tone: "neutral", status: "today", value: summary?.borrowed_today !== undefined && summary.returned_today !== undefined ? summary.borrowed_today + summary.returned_today : undefined, detail: summary?.borrowed_today !== undefined && summary.returned_today !== undefined ? `${summary.borrowed_today} borrowed · ${summary.returned_today} returned` : "Daily totals unavailable" },
  ];
  return <div className="circulation-overview" aria-label="Circulation overview" aria-busy={loading}>{tiles.map(tile => <AdminSummaryTile key={tile.status} appearance={tile.status === "overdue" ? "slip" : "shelf"} label={tile.label} value={tile.value} icon={tile.icon} tone={tile.tone as "red" | "blue" | "neutral"} hint={loading && !summary ? "Loading totals..." : tile.detail} selected={params.get("archived") !== "true" && (params.get("filter") || params.get("status") || "needs_action") === tile.status} onSelect={() => patch({ tab: "history", filter: tile.status, status: null, archived: null, search: null, dateFrom: null, dateTo: null })} />)}</div>;
}
