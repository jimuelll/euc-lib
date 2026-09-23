import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel } from "@/features/admin";
import ReservationsPagination from "./components/ReservationsPagination";
import ReservationsTable from "./components/ReservationsTable";
import ReservationsToolbar from "./components/ReservationsToolbar";
import { useReservations } from "./hooks/useReservations";
import type { AdminReservation } from "./reservations.types";

const EMPTY_ROWS: AdminReservation[] = [];

const AdminReservations = () => {
  const {
    data,
    error,
    loading,
    search,
    statusFilter,
    actionId,
    showArchived,
    confirmDialog,
    handleSearchChange,
    handleStatusChange,
    handleToggleArchived,
    setPage,
    handleMarkReady,
    handleFulfill,
    handleCancel,
    handleArchive,
    handleRestore,
    fetchReservations,
  } = useReservations();

  return (
    <AdminPage
      eyebrow="Service Desk"
      title="Reservations"
      description="Prepare pending holds, mark copies ready, and complete pickup through Borrow & Return."
      actions={
        <Button
          onClick={handleToggleArchived}
          variant={showArchived ? "default" : "outline"}
          className="min-w-[110px] rounded-md"
        >
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? "View active reservations" : "View archive"}
        </Button>
      }
    >
      {confirmDialog}
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm"><span>{error}</span><Button variant="outline" onClick={fetchReservations}>Try again</Button></div>}
      {showArchived ? (
        <div className="border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Showing archived records. Restore an item to return it to the active reservation list.
        </div>
      ) : null}

      <AdminPanel contentClassName="p-0">
        <div className="border-b border-border p-4"><ReservationsToolbar search={search} statusFilter={statusFilter} loading={loading} showArchived={showArchived} onSearchChange={handleSearchChange} onStatusChange={handleStatusChange} onRefresh={fetchReservations} /></div>
        <ReservationsTable rows={data?.rows ?? EMPTY_ROWS} loading={loading} actionId={actionId} showArchived={showArchived} onMarkReady={handleMarkReady} onFulfill={handleFulfill} onCancel={handleCancel} onArchive={handleArchive} onRestore={handleRestore} />
        {data && <ReservationsPagination page={data.page} totalPages={data.totalPages} total={data.total} loading={loading} onPageChange={setPage} />}
      </AdminPanel>
    </AdminPage>
  );
};

export default AdminReservations;
