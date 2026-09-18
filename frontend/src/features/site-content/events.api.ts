import axiosInstance from "@/utils/AxiosInstance";

export interface SiteEvent { id: number; title: string; starts_at: string; ends_at?: string | null; }
export const fetchEvents = async (includeArchived = false): Promise<SiteEvent[]> => (await axiosInstance.get<SiteEvent[]>(includeArchived ? "/api/events?all=1" : "/api/events")).data;
export const createEvent = async (payload: { title: string; starts_at: string; ends_at: string | null }): Promise<void> => { await axiosInstance.post("/api/events", payload); };
export const deleteEvent = async (eventId: number): Promise<void> => { await axiosInstance.delete(`/api/events/${eventId}`); };
