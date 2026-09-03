import { useCallback, useEffect, useState } from "react";
import { fetchMyLibraryAttendance, fetchMyLibraryHistory } from "../api";
import type { AttendanceSession, MyLibraryHistoryItem, MyLibraryPage } from "../types";

export function useMyLibraryActivity(enabled: boolean) {
  const [historyPage, setHistoryPage] = useState<MyLibraryPage<MyLibraryHistoryItem> | null>(null);
  const [attendancePage, setAttendancePage] = useState<MyLibraryPage<AttendanceSession> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      setHistoryPage(await fetchMyLibraryHistory(page));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async (page = 1) => {
    setAttendanceLoading(true);
    try {
      setAttendancePage(await fetchMyLibraryAttendance(page));
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadHistory(1);
    void loadAttendance(1);
  }, [enabled, loadAttendance, loadHistory]);

  return { attendanceLoading, attendancePage, historyLoading, historyPage, loadAttendance, loadHistory };
}
