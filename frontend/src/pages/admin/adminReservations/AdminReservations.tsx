import { Archive } from "lucide-react";
import { useReservations } from "./hooks/useReservations";
import ReservationsToolbar    from "./components/ReservationsToolbar";
import ReservationsTable      from "./components/ReservationsTable";
import ReservationsPagination from "./components/ReservationsPagination";
import type { AdminReservation } from "./reservations.types";

const EMPTY_ROWS: AdminReservation[] = [];

const AdminReservations = () => {
  const {
    data, loading,
    search, statusFilter, page, actionId, showArchived,
    handleSearchChange, handleStatusChange, handleToggleArchived,
    setPage, handleMarkReady, handleFulfill, handleCancel,
    handleArchive, handleRestore,
    fetchReservations,
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

      {/* ── Section header with archive toggle ──────────────────────── */}
      <div className="flex items-center justify-between gap-4 border border-border border-b-0 px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="h-px w-4 bg-warning shrink-0" />
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {showArchived ? "Archived Records" : "Active Reservations"}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {data.total} records
            </span>
          )}
          <button
            onClick={handleToggleArchived}
            title={showArchived ? "Showing archived — click for active" : "Show archived records"}
            className={`flex items-center gap-1.5 border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
              showArchived
                ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Archive className="h-3 w-3" />
            {showArchived ? "Archived" : "Active"}
          </button>
        </div>
      </div>

      {/* ── Archived banner ──────────────────────────────────────────── */}
      {showArchived && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-warning/5 border border-t-0 border-b-0 border-warning/20">
          <Archive className="h-3 w-3 text-warning/60 shrink-0" />
          <p
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-warning/70"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Showing archived records — restore to make them visible in the active view
          </p>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <ReservationsToolbar
        search={search}
        statusFilter={statusFilter}
        loading={loading}
        showArchived={showArchived}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onRefresh={fetchReservations}
      />

      {/* ── Top pagination ───────────────────────────────────────────── */}
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
          showArchived={showArchived}
          onMarkReady={handleMarkReady}
          onFulfill={handleFulfill}
          onCancel={handleCancel}
          onArchive={handleArchive}
          onRestore={handleRestore}
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