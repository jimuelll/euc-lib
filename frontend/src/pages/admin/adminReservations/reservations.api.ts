import axiosInstance from "@/utils/AxiosInstance";
import type {
  AdminReservation,
  ReservationFilters,
  ReservationsResult,
} from "./reservations.types";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getAdminReservations = async (
  filters: ReservationFilters = {}
): Promise<ReservationsResult> => {
  const res = await axiosInstance.get("/api/admin/reservations", { params: filters });
  return res.data;
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export const markReservationReady = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/ready`
  );
  return res.data;
};

export const fulfillReservation = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/fulfill`
  );
  return res.data;
};

export const cancelReservationAdmin = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/cancel`
  );
  return res.data;
};

/**
 * Soft-delete a terminal reservation (cancelled / expired / fulfilled).
 * Backend: sets deleted_at = NOW(), deleted_by = req.user.id
 */
export const archiveReservation = async (reservationId: number): Promise<void> => {
  await axiosInstance.delete(`/api/admin/reservations/${reservationId}`);
};

/**
 * Restore a soft-deleted reservation.
 * Backend: clears deleted_at and deleted_by
 */
export const restoreReservation = async (reservationId: number): Promise<void> => {
  await axiosInstance.patch(`/api/admin/reservations/${reservationId}/restore`);
};