import axiosInstance from "@/utils/AxiosInstance";

export async function recordSiteVisit(path: string) {
  return axiosInstance.post("/api/analytics/visit", { path });
}
