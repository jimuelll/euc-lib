import axiosInstance from "@/utils/AxiosInstance";

export interface LibraryCirculationSettings {
  overdue_fine_per_hour: number;
  updated_at: string | null;
}

export interface LibraryHoliday {
  id: number;
  name: string;
  holiday_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibrarySettingsPayload {
  settings: LibraryCirculationSettings;
  holidays: LibraryHoliday[];
}

export interface HolidayInput {
  name: string;
  holiday_date: string;
  description?: string;
}

export async function fetchLibrarySettings(): Promise<LibrarySettingsPayload> {
  const res = await axiosInstance.get("/api/admin/library-settings");
  return res.data;
}

export async function updateLibrarySettings(overdueFinePerHour: number) {
  const res = await axiosInstance.put("/api/admin/library-settings", {
    overdue_fine_per_hour: overdueFinePerHour,
  });
  return res.data;
}

export async function createLibraryHoliday(payload: HolidayInput) {
  const res = await axiosInstance.post("/api/admin/library-holidays", payload);
  return res.data;
}

export async function updateLibraryHoliday(holidayId: number, payload: HolidayInput) {
  const res = await axiosInstance.put(`/api/admin/library-holidays/${holidayId}`, payload);
  return res.data;
}

export async function deleteLibraryHoliday(holidayId: number) {
  const res = await axiosInstance.delete(`/api/admin/library-holidays/${holidayId}`);
  return res.data;
}
