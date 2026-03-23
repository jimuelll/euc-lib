import { useReservations } from "./hooks/useReservations";
import ReservationsToolbar    from "./components/ReservationsToolbar";
import ReservationsTable      from "./components/ReservationsTable";
import ReservationsPagination from "./components/ReservationsPagination";
import type { AdminReservation } from "./reservations.types";

const EMPTY_ROWS: AdminReservation[] = [];

const AdminReservations = () => {
  const {
    data,
    loading,
    search,
    statusFilter,
    page,
    actionId,
    handleSearchChange,
    handleStatusChange,
    setPage,
    handleMarkReady,
    handleFulfill,
    handleCancel,
    fetchReservations,
  } = useReservations();

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground">Reservations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pending holds, mark books ready for pickup, and fulfil or cancel reservations.
        </p>
      </div>

      <ReservationsToolbar
        search={search}
        statusFilter={statusFilter}
        loading={loading}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        onRefresh={fetchReservations}
      />

      {data && (
        <ReservationsPagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          loading={loading}
          onPageChange={setPage}
        />
      )}

      <ReservationsTable
        rows={data?.rows ?? EMPTY_ROWS}
        loading={loading}
        actionId={actionId}
        onMarkReady={handleMarkReady}
        onFulfill={handleFulfill}
        onCancel={handleCancel}
      />

      {data && data.totalPages > 1 && (
        <ReservationsPagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          loading={loading}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default AdminReservations;