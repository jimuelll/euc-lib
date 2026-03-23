import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import {
  getAdminReservations,
  markReservationReady,
  fulfillReservation,
  cancelReservationAdmin,
} from "../reservations.api";
import { PAGE_SIZE } from "../reservations.types";
import type { ReservationsResult } from "../reservations.types";

export const useReservations = () => {
  const [data, setData]           = useState<ReservationsResult | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [page, setPage]           = useState(1);
  const [actionId, setActionId]   = useState<number | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit: PAGE_SIZE };
      if (search)               filters.search = search;
      if (statusFilter !== "all") filters.status = statusFilter;

      const result = await getAdminReservations(filters);
      setData(result);
    } catch {
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // ── Filter helpers (reset page on filter change) ───────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
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

  return {
    // state
    data,
    loading,
    search,
    statusFilter,
    page,
    actionId,
    // filter handlers
    handleSearchChange,
    handleStatusChange,
    setPage,
    // action handlers
    handleMarkReady,
    handleFulfill,
    handleCancel,
    fetchReservations,
  };
};