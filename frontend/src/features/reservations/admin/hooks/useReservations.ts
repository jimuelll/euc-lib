import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { invalidateServerState } from "@/app/server-state";
import { useAdminUrlState, queryPage, useAdminConfirmDialog } from "@/features/admin";
import {
  archiveReservation,
  cancelReservationAdmin,
  getAdminReservations,
  markReservationReady,
  restoreReservation,
} from "../reservations.api";
import { PAGE_SIZE, type AdminReservation, type ReservationFilters, type ReservationsResult } from "../reservations.types";
import { normalizeReservationFilters, reservationsKeys } from "../reservations.keys";

type ReservationCacheSnapshot = Array<[QueryKey, ReservationsResult | undefined]>;

function removeReservationFromCachedLists(
  queryClient: ReturnType<typeof useQueryClient>,
  reservationId: number
): ReservationCacheSnapshot {
  const previous = queryClient.getQueriesData<ReservationsResult>({
    queryKey: reservationsKeys.lists(),
  });

  previous.forEach(([queryKey, result]) => {
    if (!result?.rows.some((reservation) => reservation.id === reservationId)) return;

    queryClient.setQueryData<ReservationsResult>(queryKey, {
      ...result,
      rows: result.rows.filter((reservation) => reservation.id !== reservationId),
      total: Math.max(0, result.total - 1),
    });
  });

  return previous;
}

function restoreReservationCache(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReservationCacheSnapshot | undefined
) {
  snapshot?.forEach(([queryKey, result]) => {
    if (result) queryClient.setQueryData(queryKey, result);
  });
}

const actionErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ?? fallback;

export const useReservations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, patchParams] = useAdminUrlState();
  const search = params.get("q") ?? "";
  const statusFilter = ["all", "needs_action", "closed", "attention", "pending", "ready", "fulfilled", "cancelled", "expired"].includes((params.get("filter") ?? params.get("status")) ?? "")
    ? (params.get("filter") ?? params.get("status"))!
    : "needs_action";
  const page = queryPage(params.get("page"));
  const setPage = (nextPage: number) => patchParams({ page: nextPage });
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const showArchived = params.get("archived") === "true";
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const filters = useMemo<ReservationFilters>(() => normalizeReservationFilters({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(showArchived ? { archived: true } : {}),
    ...(Number(params.get('recordId'))>0?{recordId:Number(params.get('recordId'))}:{}),
    ...(!showArchived && statusFilter !== "all" ? { status: statusFilter } : {}),
  }), [page, search, showArchived, statusFilter,params.get("recordId")]);

  const reservationsQuery = useQuery({
    queryKey: reservationsKeys.list(filters),
    queryFn: ({ signal }) => getAdminReservations(filters, signal),
    placeholderData: (previousData) => previousData,
  });

  const invalidateReservationLists = useCallback(
    () => queryClient.invalidateQueries({ queryKey: reservationsKeys.lists() }),
    [queryClient]
  );

  const markReadyMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => markReservationReady(id),
    onSuccess: () => invalidateServerState(queryClient, "reservation"),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => reason ? cancelReservationAdmin(id, reason) : cancelReservationAdmin(id),
    onSuccess: () => invalidateServerState(queryClient, "reservation"),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => archiveReservation(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: reservationsKeys.lists() });
      return removeReservationFromCachedLists(queryClient, id);
    },
    onError: (_error, _variables, snapshot) => {
      restoreReservationCache(queryClient, snapshot);
    },
    onSuccess: invalidateReservationLists,
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => restoreReservation(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: reservationsKeys.lists() });
      return removeReservationFromCachedLists(queryClient, id);
    },
    onError: (_error, _variables, snapshot) => {
      restoreReservationCache(queryClient, snapshot);
    },
    onSuccess: invalidateReservationLists,
  });

  const { refetch } = reservationsQuery;
  const fetchReservations = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleSearchChange = (nextSearch: string) => patchParams({ q: nextSearch, page: null }, true);
  const handleStatusChange = (status: string) => patchParams({ filter: status, status: null, page: null });
  const handleToggleArchived = () => patchParams({ archived: !showArchived, page: null });

  const handleMarkReady = async (id: number, title: string) => {
    setActionId(id);
    try {
      await markReadyMutation.mutateAsync({ id });
      toast.success(`"${title}" marked as ready for pickup`);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Action failed"));
    } finally {
      setActionId(null);
    }
  };

  const handleFulfill = async (reservation: AdminReservation) => {
    const shouldStartCheckout = await confirm({
      title: `Process pickup for "${reservation.book_title}"?`,
      description: `Continue to Borrow & Return for ${reservation.user_name}. ${reservation.reserved_copy_barcode ? "The prepared copy and patron will be filled in." : "Scan a physical copy to continue."} The reservation stays ready until checkout succeeds.`,
      actionLabel: "Process pickup",
    });
    if (!shouldStartCheckout) return;
    navigate("/admin/circulation?tab=transaction&mode=borrow", { state: { checkoutReservation: reservation } });
  };

  const handleCancel = async (id: number, title: string, reason?: string) => {
    if (!reason && !await confirm({ title: `Cancel "${title}" reservation?`, description: "This releases the hold and notifies the patron.", actionLabel: "Cancel reservation", cancelLabel: "Keep reservation", tone: "danger" })) return;
    setActionId(id);
    try {
      await cancelMutation.mutateAsync({ id, reason });
      toast.success(`Reservation for "${title}" cancelled`);
    } catch (error) {
      toast.error(actionErrorMessage(error, "Action failed"));
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (id: number, title: string) => {
    const shouldArchive = await confirm({
      title: `Archive "${title}" reservation?`,
      description: "The reservation will move out of the active queue until it is restored.",
      actionLabel: "Archive Reservation",
      tone: "danger",
    });
    if (!shouldArchive) return;
    setActionId(id);
    try {
      await archiveMutation.mutateAsync({ id });
      toast.success("Reservation archived");
    } catch (error) {
      toast.error(actionErrorMessage(error, "Failed to archive reservation"));
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (id: number, title: string) => {
    const shouldRestore = await confirm({
      title: `Restore "${title}" reservation?`,
      description: "The reservation will return to the active reservation records.",
      actionLabel: "Restore Reservation",
    });
    if (!shouldRestore) return;
    setActionId(id);
    try {
      await restoreMutation.mutateAsync({ id });
      toast.success("Reservation restored");
    } catch (error) {
      toast.error(actionErrorMessage(error, "Failed to restore reservation"));
    } finally {
      setActionId(null);
    }
  };

  // Existing per-record endpoints preserve validation, notification and audit behavior.
  const handleBulk = async (kind: "ready" | "cancel" | "archive", rows: AdminReservation[], reason?: string) => {
    if (!rows.length || bulkBusy || actionId !== null) return;
    if (kind !== "cancel" && !await confirm({ title: `${kind === "ready" ? "Mark ready" : "Archive"} ${rows.length} reservations?`, description: kind === "ready" ? "Each reservation is checked for an available copy before preparation." : "Closed reservations can be restored from the archive.", actionLabel: kind === "ready" ? "Mark ready" : "Archive closed" })) return;
    if (kind === "cancel" && !reason?.trim()) return;
    setBulkBusy(true);
    let succeeded = 0;
    const failed: number[] = [];
    try {
      for (const row of rows) {
        try {
          if (kind === "ready") await markReservationReady(row.id);
          else if (kind === "cancel") await cancelReservationAdmin(row.id, reason);
          else await archiveReservation(row.id);
          succeeded++;
        } catch { failed.push(row.id); }
      }
      await invalidateServerState(queryClient, "reservation");
      if (succeeded) toast.success(`${succeeded} ${succeeded === 1 ? "reservation" : "reservations"} ${kind === "ready" ? "marked ready" : kind === "cancel" ? "cancelled" : "archived"}`);
      if (failed.length) toast.error(`${failed.length} could not be updated. Failed record IDs: ${failed.join(", ")}. Refresh and review before retrying.`);
    } finally { setBulkBusy(false); }
  };

  const handleArchiveClosed = async () => {
    if (bulkBusy || actionId !== null) return;
    setBulkBusy(true);
    const rows: AdminReservation[] = [];
    try {
      let page = 1, totalPages = 1;
      do {
        const result = await getAdminReservations({ status: "closed", limit: 50, page, ...(search.trim() ? { search: search.trim() } : {}) });
        rows.push(...result.rows.filter(row => ["fulfilled", "cancelled", "expired"].includes(row.status)));
        totalPages = result.totalPages; page++;
      } while (page <= totalPages);
    } catch { toast.error("Closed reservations could not be loaded. Nothing was archived."); return; }
    finally { setBulkBusy(false); }
    if (!rows.length) { toast.info("No closed reservations to archive."); return; }
    await handleBulk("archive", rows);
  };

  return {
    data: reservationsQuery.data ?? null,
    error: reservationsQuery.isError ? "Reservations could not be loaded. Try again." : "",
    loading: reservationsQuery.isFetching,
    initialLoading: reservationsQuery.isPending,
    updatedAt: reservationsQuery.dataUpdatedAt,
    bulkBusy,
    handleBulk,
    handleArchiveClosed,
    search,
    statusFilter,
    page,
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
  };
};
