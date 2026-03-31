import axiosInstance from "@/utils/AxiosInstance";
import type { MyLibraryDashboard } from "./types";

export async function fetchMyLibraryDashboard(signal?: AbortSignal): Promise<MyLibraryDashboard> {
  const res = await axiosInstance.get("/api/my-library/dashboard", { signal });
  return res.data;
}
