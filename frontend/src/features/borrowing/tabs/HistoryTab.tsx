import { Skeleton } from "@/components/ui/skeleton";
import type { ReservationHistory } from "../types";
import ReservationPagination from "../components/ReservationPagination";
export default function HistoryTab({ history, loading, pagination, onPageChange }: { history: ReservationHistory[]; loading: boolean; pagination: { page: number; totalPages: number }; onPageChange: (page: number) => void }) {
  if (loading) return <div className="service-loading" role="status" aria-label="Loading reservation history">{[0, 1, 2].map(id => <Skeleton key={id} className="h-24 w-full" />)}</div>;
  return <section aria-label="Past reservations"><h2 className="reservation-section-label">Past reservations</h2>
    {history.length === 0 ? <p className="service-empty">No reservation history yet.</p> : history.map(res => {
      const date = res.status === "fulfilled" ? res.fulfilled_at : res.status === "cancelled" ? res.cancelled_at : res.expires_at;
      const value = new Date(date || res.reserved_at);
      return <article className="reservation-history-row" key={res.id}><div><h3>{res.title}</h3><small>{res.author}</small></div><time dateTime={date || res.reserved_at}>{Number.isFinite(value.getTime()) ? value.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Date not recorded"}</time><span className={"reservation-status " + (res.status === "fulfilled" ? "is-ready" : "")}>{res.status === "fulfilled" ? "Fulfilled" : res.status === "cancelled" ? "Cancelled" : "Expired"}</span></article>;
    })}<ReservationPagination pagination={pagination} onPageChange={onPageChange} />
  </section>;
}
