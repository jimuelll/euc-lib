import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyLibraryAttendance, fetchMyLibraryHistory } from "../api";
import { myLibraryKeys } from "../my-library.keys";

export function useMyLibraryActivity(enabled: boolean) {
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const [attendancePageNumber, setAttendancePageNumber] = useState(1);
  const historyQuery = useQuery({
    queryKey: myLibraryKeys.history(historyPageNumber),
    queryFn: ({ signal }) => fetchMyLibraryHistory(historyPageNumber, signal),
    enabled,
    placeholderData: (previousData) => previousData,
  });
  const attendanceQuery = useQuery({
    queryKey: myLibraryKeys.attendance(attendancePageNumber),
    queryFn: ({ signal }) => fetchMyLibraryAttendance(attendancePageNumber, signal),
    enabled,
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
    attendanceLoading: attendanceQuery.isFetching,
    attendancePage: attendanceQuery.data ?? null,
    historyLoading: historyQuery.isFetching,
    historyPage: historyQuery.data ?? null,
    loadAttendance,
    loadHistory,
  };
}
