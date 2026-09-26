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
  const statusFilter = ["pending", "ready", "fulfilled", "cancelled", "expired"].includes(params.get("status") ?? "")
    ? params.get("status")!
    : "all";
  const page = queryPage(params.get("page"));
  const setPage = (nextPage: number) => patchParams({ page: nextPage });
  const [actionId, setActionId] = useState<number | null>(null);
  const showArchived = params.get("archived") === "true";
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  const filters = useMemo<ReservationFilters>(() => normalizeReservationFilters({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(showArchived ? { archived: true } : {}),
    ...(!showArchived && statusFilter !== "all" ? { status: statusFilter } : {}),
  }), [page, search, showArchived, statusFilter]);

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
    mutationFn: ({ id }: { id: number }) => cancelReservationAdmin(id),
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
  const handleStatusChange = (status: string) => patchParams({ status, page: null });
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
      title: `Fulfill "${reservation.book_title}"?`,
      description: `Continue to Borrow & Return to scan a physical copy for ${reservation.user_name}. The reservation stays ready until checkout succeeds.`,
      actionLabel: "Start Checkout",
    });
    if (!shouldStartCheckout) return;
    navigate("/admin/circulation", { state: { checkoutReservation: reservation } });
  };

  const handleCancel = async (id: number, title: string) => {
    setActionId(id);
    try {
      await cancelMutation.mutateAsync({ id });
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

  return {
    data: reservationsQuery.data ?? null,
    error: reservationsQuery.isError ? "Reservations could not be loaded. Try again." : "",
    loading: reservationsQuery.isFetching,
    initialLoading: reservationsQuery.isPending,
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
