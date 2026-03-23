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

/**
 * Mark a pending reservation as ready for pickup.
 * Backend: sets status = 'ready'
 */
export const markReservationReady = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/ready`
  );
  return res.data;
};

/**
 * Fulfil a ready reservation — patron has collected the book.
 * Backend: sets status = 'fulfilled', fulfilled_at = NOW()
 */
export const fulfillReservation = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/fulfill`
  );
  return res.data;
};

/**
 * Cancel any active (pending / ready) reservation from the admin side.
 * Backend: sets status = 'cancelled', cancelled_at = NOW()
 */
export const cancelReservationAdmin = async (
  reservationId: number
): Promise<AdminReservation> => {
  const res = await axiosInstance.post(
    `/api/admin/reservations/${reservationId}/cancel`
  );
  return res.data;
};