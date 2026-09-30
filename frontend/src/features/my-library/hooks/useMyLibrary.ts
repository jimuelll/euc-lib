import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/utils/apiError";
import { fetchMyLibraryDashboard } from "../api";
import { myLibraryKeys } from "../my-library.keys";

export function useMyLibrary(enabled = true) {
  const query = useQuery({
    queryKey: myLibraryKeys.dashboard(),
    queryFn: ({ signal }) => fetchMyLibraryDashboard(signal),
    enabled,
  });

  return {
    data: query.data ?? null,
    loading: enabled && query.isPending,
    error: query.isError
      ? getApiErrorMessage(query.error, "Failed to load your library dashboard")
      : null,
    refreshing: query.isFetching,
    retry: query.refetch,
  };
}
