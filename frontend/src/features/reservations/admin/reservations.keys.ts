import { PAGE_SIZE, type ReservationFilters } from "./reservations.types";

const RESERVATIONS_KEY = ["admin-reservations"] as const;

export function normalizeReservationFilters(
  filters: ReservationFilters = {}
): ReservationFilters {
  const search = filters.search?.trim();
  const status = filters.status?.trim();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();

  return {
    page: Math.max(1, Math.floor(Number(filters.page) || 1)),
    limit: Math.max(1, Math.floor(Number(filters.limit) || PAGE_SIZE)),
    ...(status && status !== "all" ? { status } : {}),
    ...(search ? { search } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(filters.archived ? { archived: true as const } : {}),
  };
}

export const reservationsKeys = {
  all: RESERVATIONS_KEY,
  lists: () => [...RESERVATIONS_KEY, "list"] as const,
  list: (filters: ReservationFilters = {}) =>
    [...RESERVATIONS_KEY, "list", normalizeReservationFilters(filters)] as const,
};
