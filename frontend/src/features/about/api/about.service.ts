import axiosInstance from "@/utils/AxiosInstance";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface StaffMember  { name: string; role: string; image_alt?:string; image_url?: string } // ← added
export interface LibrarySpace { name: string; description: string; image_alt?:string; image_url: string }

export interface AboutSettings {
  library_name:  string;
  established:   number | null;
  mission_title: string;
  mission_text:  string;
  history_title: string;
  history_text:  string;
  policies:      string[];
  facilities:    string[];
  staff:         StaffMember[];
  spaces:        LibrarySpace[];
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Public — no auth required */
export const getAboutSettings = async (signal?: AbortSignal): Promise<AboutSettings> => {
  const res = await axiosInstance.get("/api/about", { signal });
  return res.data;
};

/** Admin-only — requires admin or super_admin role */


/** Admin-only — upload a staff member photo directly to Cloudinary via the frontend */
