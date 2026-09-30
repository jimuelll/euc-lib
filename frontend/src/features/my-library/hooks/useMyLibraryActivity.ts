import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyLibraryAttendance, fetchMyLibraryHistory } from "../api";
import { myLibraryKeys } from "../my-library.keys";
import { getApiErrorMessage } from "@/utils/apiError";

export function useMyLibraryActivity({
  historyEnabled,
  attendanceEnabled,
}: {
  historyEnabled: boolean;
  attendanceEnabled: boolean;
}) {
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const [attendancePageNumber, setAttendancePageNumber] = useState(1);
  const historyQuery = useQuery({
    queryKey: myLibraryKeys.history(historyPageNumber),
    queryFn: ({ signal }) => fetchMyLibraryHistory(historyPageNumber, signal),
    enabled: historyEnabled,
    placeholderData: (previousData) => previousData,
  });
  const attendanceQuery = useQuery({
    queryKey: myLibraryKeys.attendance(attendancePageNumber),
    queryFn: ({ signal }) =>
      fetchMyLibraryAttendance(attendancePageNumber, signal),
    enabled: attendanceEnabled,
    placeholderData: (previousData) => previousData,
  });
  const loadHistory = async (page = 1) => {
    if (page === historyPageNumber) await historyQuery.refetch();
    else setHistoryPageNumber(page);
  };
  const loadAttendance = async (page = 1) => {
    if (page === attendancePageNumber) await attendanceQuery.refetch();
    else setAttendancePageNumber(page);
  };

  return {
    attendanceLoading: attendanceEnabled && attendanceQuery.isPending,
    attendanceRefreshing: attendanceQuery.isFetching,
    attendanceError: attendanceQuery.isError
      ? getApiErrorMessage(
          attendanceQuery.error,
          "Library visits could not be loaded.",
        )
      : null,
    attendancePage: attendanceQuery.data ?? null,
    historyLoading: historyEnabled && historyQuery.isPending,
    historyRefreshing: historyQuery.isFetching,
    historyError: historyQuery.isError
      ? getApiErrorMessage(
          historyQuery.error,
          "Loan and reservation history could not be loaded.",
        )
      : null,
    historyPage: historyQuery.data ?? null,
    loadAttendance,
    loadHistory,
  };
}
