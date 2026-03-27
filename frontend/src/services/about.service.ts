import axiosInstance from "@/utils/AxiosInstance";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface StaffMember  { name: string; role: string; image_url?: string } // ← added
export interface LibrarySpace { name: string; description: string; image_url: string }

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
export const getAboutSettings = async (): Promise<AboutSettings> => {
  const res = await axiosInstance.get("/api/about");
  return res.data;
};

/** Admin-only — requires admin or super_admin role */
export const getAboutSettingsAdmin = async (): Promise<AboutSettings> => {
  const res = await axiosInstance.get("/api/admin/about");
  return res.data;
};

export const updateAboutSettings = async (
  payload: Omit<AboutSettings, "established"> & { established: number | null }
): Promise<AboutSettings> => {
  const res = await axiosInstance.put("/api/admin/about", payload);
  return res.data.data;
};

/** Admin-only — upload a staff member photo directly to Cloudinary via the frontend */
export const uploadStaffImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "library/staff");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Failed to upload staff image");
  const data = await res.json();
  return data.secure_url;
};