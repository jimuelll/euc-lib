import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel } from "../components/AdminPage";
import ReservationsPagination from "./components/ReservationsPagination";
import ReservationsTable from "./components/ReservationsTable";
import ReservationsToolbar from "./components/ReservationsToolbar";
import { useReservations } from "./hooks/useReservations";
import type { AdminReservation } from "./reservations.types";

const EMPTY_ROWS: AdminReservation[] = [];

const AdminReservations = () => {
  const {
    data,
    loading,
    search,
    statusFilter,
    actionId,
    showArchived,
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
      eyebrow="Library Management"
      title="Reservations"
      description="Review pending holds, mark books ready for pickup, and fulfill, cancel, archive, or restore reservations from one list."
      actions={
        <Button
          onClick={handleToggleArchived}
          variant={showArchived ? "default" : "outline"}
          className="min-w-[110px]"
        >
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? "Archived" : "Active"}
        </Button>
      }
    >
      {showArchived ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Showing archived records. Restore an item to return it to the active reservation list.
        </div>
      ) : null}

      <AdminPanel
        title={showArchived ? "Archived records" : "Active reservations"}
        description={
          data ? `${data.total} record${data.total === 1 ? "" : "s"} in the current view.` : "Manage reservation records and narrow results using the filters below."
        }
      >
        <ReservationsToolbar
          search={search}
          statusFilter={statusFilter}
          loading={loading}
          showArchived={showArchived}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onRefresh={fetchReservations}
        />
      </AdminPanel>

      {data ? (
        <ReservationsPagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          loading={loading}
          onPageChange={setPage}
        />
      ) : null}

      <AdminPanel
        title="Reservation table"
        description="Use row actions to move reservations through the workflow."
        contentClassName="p-0"
      >
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
      </AdminPanel>

      {data && data.totalPages > 1 ? (
        <ReservationsPagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          loading={loading}
          onPageChange={setPage}
        />
      ) : null}
    </AdminPage>
  );
};

export default AdminReservations;
