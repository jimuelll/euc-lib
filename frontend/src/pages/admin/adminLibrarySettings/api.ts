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

export interface AcademicProgram {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}
export interface AcademicTerm { id: number; name: string; starts_on: string; ends_on: string; is_current: number; }

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

export async function fetchAcademicPrograms(): Promise<AcademicProgram[]> {
  const res = await axiosInstance.get("/api/admin/academic-programs");
  return res.data.programs ?? [];
}

export async function createAcademicProgram(name: string) {
  const res = await axiosInstance.post("/api/admin/academic-programs", { name });
  return res.data;
}

export async function updateAcademicProgram(programId: number, name: string) {
  const res = await axiosInstance.put(`/api/admin/academic-programs/${programId}`, { name });
  return res.data;
}

export async function deleteAcademicProgram(programId: number) {
  const res = await axiosInstance.delete(`/api/admin/academic-programs/${programId}`);
  return res.data;
}
export async function fetchAcademicTerms(): Promise<AcademicTerm[]> { const res = await axiosInstance.get("/api/admin/academic-terms"); return res.data.terms ?? []; }
export async function createAcademicTerm(payload: { name: string; starts_on: string; ends_on: string; is_current: boolean }) { const res = await axiosInstance.post("/api/admin/academic-terms", payload); return res.data; }
export async function setCurrentAcademicTerm(termId: number) { const res = await axiosInstance.post(`/api/admin/academic-terms/${termId}/current`); return res.data; }
