import axiosInstance from "@/utils/AxiosInstance";
import type { ActiveReservation, CatalogBook, ReservationHistory } from "./types";

export type ReservationPagination = { page: number; limit: number; total: number; totalPages: number };
export type ReservationHistoryResponse = { rows: ReservationHistory[]; pagination: ReservationPagination };
export const fetchActiveReservations = async (): Promise<ActiveReservation[]> => (await axiosInstance.get<ActiveReservation[]>("api/reservations/active")).data;
export const fetchReservationHistory = async (page: number): Promise<ReservationHistoryResponse> => (await axiosInstance.get<ReservationHistoryResponse>("api/reservations/history", { params: { page, limit: 20 } })).data;
export const searchReservationCatalogue = async (query: string, page: number): Promise<{ rows: CatalogBook[]; pagination: ReservationPagination }> => (await axiosInstance.get("api/reservations/catalogue/search", { params: { query: query.trim(), page, limit: 20 } })).data;
export const reserveBook = async (bookId: number): Promise<{ reservationId: number; expiresAt: string | null }> => (await axiosInstance.post(`api/reservations/${bookId}`)).data;
export const cancelReservation = async (reservationId: number): Promise<void> => { await axiosInstance.post(`api/reservations/${reservationId}/cancel`); };
