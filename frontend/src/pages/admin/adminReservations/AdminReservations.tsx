import { useReservations } from "./hooks/useReservations";
import ReservationsToolbar    from "./components/ReservationsToolbar";
import ReservationsTable      from "./components/ReservationsTable";
import ReservationsPagination from "./components/ReservationsPagination";
import type { AdminReservation } from "./reservations.types";

const EMPTY_ROWS: AdminReservation[] = [];

const AdminReservations = () => {
  const {
    data, loading,
    search, statusFilter, page, actionId,
    handleSearchChange, handleStatusChange,
    setPage, handleMarkReady, handleFulfill,
    handleCancel, fetchReservations,
  } = useReservations();

  return (
    <div className="max-w-4xl space-y-0">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-px w-4 bg-warning shrink-0" />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Library Management
          </span>
        </div>
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
        >
          Reservations
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Review pending holds, mark books ready for pickup, and fulfil or cancel reservations.
        </p>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <ReservationsToolbar
        search={search}
        statusFilter={statusFilter}
        loading={loading}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onRefresh={fetchReservations}
      />

      {/* ── Top pagination (border shares with toolbar) ──────────────── */}
      {data && (
        <div className="border-t-0">
          <ReservationsPagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className={data ? "border-t-0" : ""}>
        <ReservationsTable
          rows={data?.rows ?? EMPTY_ROWS}
          loading={loading}
          actionId={actionId}
          onMarkReady={handleMarkReady}
          onFulfill={handleFulfill}
          onCancel={handleCancel}
        />
      </div>

      {/* ── Bottom pagination ────────────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="border-t-0">
          <ReservationsPagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default AdminReservations;