import { useAdminUrlState, queryPage } from "@/features/admin";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  getAdminReservations,
  markReservationReady,
  cancelReservationAdmin,
  archiveReservation,
  restoreReservation,
} from "../reservations.api";
import { PAGE_SIZE } from "../reservations.types";
import type { AdminReservation, ReservationsResult } from "../reservations.types";
import { useAdminConfirmDialog } from "@/features/admin";

export const useReservations = () => {
  const navigate = useNavigate();
  const [params, patchParams] = useAdminUrlState();
  const [data,         setData]         = useState<ReservationsResult | null>(null);
  const [loading,      setLoading]      = useState(true);
  const search = params.get("q") ?? "";
  const statusFilter = ["pending", "ready", "fulfilled", "cancelled", "expired"].includes(params.get("status") ?? "") ? params.get("status")! : "all";
  const page = queryPage(params.get("page"));
  const setPage = (page: number) => patchParams({ page });
  const [actionId,     setActionId]     = useState<number | null>(null);
  const showArchived = params.get("archived") === "true";
  const [error, setError] = useState("");
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search)                filters.search   = search;
      if (showArchived)          filters.archived = true;
      // status filter is hidden in archived mode (all archived are terminal)
      if (!showArchived && statusFilter !== "all") filters.status = statusFilter;

      const result = await getAdminReservations(filters);
      setData(result);
    } catch {
      setError("Reservations could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, showArchived]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleSearchChange = (q: string) => patchParams({ q, page: null }, true);
  const handleStatusChange = (status: string) => patchParams({ status, page: null });
  const handleToggleArchived = () => patchParams({ archived: !showArchived, page: null });

  const handleMarkReady = async (id: number, title: string) => {
    setActionId(id);
    try {
      await markReservationReady(id);
      toast.success(`"${title}" marked as ready for pickup`);
      fetchReservations();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Action failed");
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
      await cancelReservationAdmin(id);
      toast.success(`Reservation for "${title}" cancelled`);
      fetchReservations();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Action failed");
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
      await archiveReservation(id);
      toast.success("Reservation archived");
      // Optimistically remove from list
      setData((prev) =>
        prev
          ? { ...prev, rows: prev.rows.filter((r) => r.id !== id), total: prev.total - 1 }
          : prev
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to archive reservation");
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
      await restoreReservation(id);
      toast.success("Reservation restored");
      setData((prev) =>
        prev
          ? { ...prev, rows: prev.rows.filter((r) => r.id !== id), total: prev.total - 1 }
          : prev
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to restore reservation");
    } finally {
      setActionId(null);
    }
  };

  return {
    // state
    data,
    error,
    loading,
    search,
    statusFilter,
    page,
    actionId,
    showArchived,
    confirmDialog,
    // filter handlers
    handleSearchChange,
    handleStatusChange,
    handleToggleArchived,
    setPage,
    // action handlers
    handleMarkReady,
    handleFulfill,
    handleCancel,
    handleArchive,
    handleRestore,
    fetchReservations,
  };
};
