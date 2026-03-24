/**
 * hooks/useCloudinaryUpload.ts
 *
 * Uploads a File or Blob directly to Cloudinary from the browser.
 * Accepts Blob so cropped canvas output can be uploaded without
 * converting back to a File first.
 *
 * Setup — add to your .env:
 *   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
 *
 * Returns:
 *   result.secure_url  → store in DB as image_url
 *   result.public_id   → store in DB as image_public_id (used for deletion)
 */

import { useState, useCallback } from "react";

export interface CloudinaryResult {
  secure_url: string;
  public_id: string;
}

interface UseCloudinaryUpload {
  upload: (file: File | Blob) => Promise<CloudinaryResult | null>;
  uploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export function useCloudinaryUpload(): UseCloudinaryUpload {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File | Blob): Promise<CloudinaryResult | null> => {
      if (!CLOUD_NAME || !UPLOAD_PRESET) {
        setError("Cloudinary is not configured. Contact your administrator.");
        return null;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      return new Promise<CloudinaryResult | null>((resolve) => {
        const formData = new FormData();
        // Cloudinary requires a filename when appending a Blob
        const filename = file instanceof File ? file.name : "image.jpg";
        formData.append("file", file, filename);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "library/bulletin");

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          setUploading(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            setProgress(100);
            resolve({ secure_url: data.secure_url, public_id: data.public_id });
          } else {
            setError("Upload failed. Please try again.");
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          setUploading(false);
          setError("Network error during upload.");
          resolve(null);
        });

        xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
        xhr.send(formData);
      });
    },
    []
  );

  return { upload, uploading, progress, error, reset };
}