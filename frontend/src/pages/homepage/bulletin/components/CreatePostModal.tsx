import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2, AlertCircle, Pin } from "lucide-react";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}

interface FormState {
  title: string;
  excerpt: string;
  content: string;
  is_pinned: boolean;
}

const MAX_EXCERPT = 200;
const MAX_TITLE   = 120;
const MAX_BYTES   = 5 * 1024 * 1024;
const ACCEPTED    = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const CAN_PIN_ROLES = ["admin", "super_admin"];

function validateImage(file: File | Blob): string | null {
  if (!ACCEPTED.includes(file.type)) return "Only JPEG, PNG, WebP, or GIF are allowed.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

export function CreatePostModal({ open, onClose, onCreated }: CreatePostModalProps) {
  const { user } = useAuth();
  const canPin   = CAN_PIN_ROLES.includes(user?.role ?? "");

  const [form, setForm]               = useState<FormState>({ title: "", excerpt: "", content: "", is_pinned: false });
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [imageFile, setImageFile]   = useState<File | Blob | null>(null);

  const { upload, uploading, progress, error: uploadError, reset: resetUpload } = useCloudinaryUpload();

  // Paste handler
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === "file" && i.type.startsWith("image/")
      );
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const err = validateImage(file);
      if (err) { setSubmitError(err); return; }
      applyImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyImage = useCallback((file: File | Blob) => {
    setPreviewSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setImageFile(file);
    setSubmitError(null);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImage(file);
    if (err) { setSubmitError(err); return; }
    applyImage(file);
    e.target.value = "";
  }, [applyImage]);

  const clearImage = useCallback(() => {
    setPreviewSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setImageFile(null);
    resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [resetUpload]);

  const handleClose = useCallback(() => {
    setForm({ title: "", excerpt: "", content: "", is_pinned: false });
    clearImage();
    setSubmitError(null);
    onClose();
  }, [clearImage, onClose]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      setSubmitError("Title, excerpt, and content are all required.");
      return;
    }
    setSubmitting(true);

    let image_url: string | null = null;
    let image_public_id: string | null = null;

    if (imageFile) {
      const result = await upload(imageFile);
      if (!result) { setSubmitting(false); return; }
      image_url       = result.secure_url;
      image_public_id = result.public_id;
    }

    try {
      const { data } = await axiosInstance.post("/api/bulletin", {
        ...form,
        image_url,
        image_public_id,
      });
      onCreated(data.id);
      handleClose();
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = uploading || submitting;
  const error  = submitError ?? uploadError;

  const inputClass =
    "w-full rounded-xl border border-border bg-muted/30 px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-bold text-lg">New Bulletin Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={MAX_TITLE}
              placeholder="e.g. Library closed on April 5"
              className={`${inputClass} h-10`}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {form.title.length}/{MAX_TITLE}
            </p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Excerpt <span className="text-destructive">*</span>
            </label>
            <textarea
              name="excerpt"
              value={form.excerpt}
              onChange={handleChange}
              maxLength={MAX_EXCERPT}
              rows={2}
              placeholder="Short summary shown on cards…"
              className={`${inputClass} py-2.5 resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {form.excerpt.length}/{MAX_EXCERPT}
            </p>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Full content <span className="text-destructive">*</span>
            </label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={6}
              placeholder="Full post body…"
              className={`${inputClass} py-2.5 resize-none`}
            />
          </div>

          {/* Pin toggle — admins only */}
          {canPin && (
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Pin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Pin this post</p>
                  <p className="text-[11px] text-muted-foreground">
                    Pinned posts appear at the top of the board.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, is_pinned: !prev.is_pinned }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  form.is_pinned ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                    form.is_pinned ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Image */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Cover image{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>

            {previewSrc ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="w-full object-contain"
                  style={{ maxHeight: "260px" }}
                />
                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-medium">{progress}%</span>
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {!uploading && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">Click to upload · or paste (Ctrl+V)</span>
                <span className="text-xs opacity-50">JPEG, PNG, WebP · max 5 MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleClose}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={handleSubmit}
            disabled={isBusy}
          >
            {isBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {uploading ? "Uploading…" : submitting ? "Posting…" : "Publish post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}