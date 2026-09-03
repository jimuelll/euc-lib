import axiosInstance from "@/utils/AxiosInstance";
import type { AttendanceSession, MyLibraryDashboard, MyLibraryHistoryItem, MyLibraryPage } from "./types";

export async function fetchMyLibraryDashboard(signal?: AbortSignal): Promise<MyLibraryDashboard> {
  const res = await axiosInstance.get("/api/my-library/dashboard", { signal });
  return res.data;
}

export async function fetchMyLibraryHistory(page = 1, signal?: AbortSignal): Promise<MyLibraryPage<MyLibraryHistoryItem>> {
  const res = await axiosInstance.get("/api/my-library/history", { params: { page, limit: 20 }, signal });
  return res.data;
}

export async function fetchMyLibraryAttendance(page = 1, signal?: AbortSignal): Promise<MyLibraryPage<AttendanceSession>> {
  const res = await axiosInstance.get("/api/my-library/attendance", { params: { page, limit: 20 }, signal });
  return res.data;
}
