import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import {
  getAdminReservations,
  markReservationReady,
  fulfillReservation,
  cancelReservationAdmin,
  archiveReservation,
  restoreReservation,
} from "../reservations.api";
import { PAGE_SIZE } from "../reservations.types";
import type { ReservationsResult } from "../reservations.types";
import { useAdminConfirmDialog } from "../../components/useAdminConfirmDialog";

export const useReservations = () => {
  const [data,         setData]         = useState<ReservationsResult | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatus]       = useState("all");
  const [page,         setPage]         = useState(1);
  const [actionId,     setActionId]     = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirmDialog();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search)                filters.search   = search;
      if (showArchived)          filters.archived = true;
      // status filter is hidden in archived mode (all archived are terminal)
      if (!showArchived && statusFilter !== "all") filters.status = statusFilter;

      const result = await getAdminReservations(filters);
      setData(result);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, showArchived]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // Reset page whenever filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, showArchived]);

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const handleToggleArchived = () => {
    setShowArchived((prev) => !prev);
    setPage(1);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  const handleFulfill = async (id: number, title: string) => {
    setActionId(id);
    try {
      await fulfillReservation(id);
      toast.success(`Reservation for "${title}" fulfilled`);
      fetchReservations();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Action failed");
    } finally {
      setActionId(null);
    }
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
