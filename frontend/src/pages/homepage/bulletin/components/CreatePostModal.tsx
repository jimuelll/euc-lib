import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const MAX_EXCERPT    = 200;
const MAX_TITLE      = 120;
const MAX_BYTES      = 5 * 1024 * 1024;
const ACCEPTED       = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const CAN_PIN_ROLES  = ["admin", "super_admin"];

function validateImage(file: File | Blob): string | null {
  if (!ACCEPTED.includes(file.type)) return "Only JPEG, PNG, WebP, or GIF are allowed.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

// ── Shared field label ────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label
    className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
    {required && <span className="text-destructive">*</span>}
  </label>
);

// ── Shared input class ────────────────────────────────────────────────────────
const inputBase =
  "w-full border border-border bg-background px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary focus:ring-0 transition-colors duration-150";

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] overflow-y-auto p-0 gap-0 border-border shadow-2xl"
        style={{ borderRadius: 0 }}
      >

        {/* ── Modal header band — same primary-band grammar ── */}
        <div className="bg-primary relative overflow-hidden">
          <div className="h-[3px] w-full bg-warning" />
          <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
            }}
          />
          <div className="relative z-10 flex items-center justify-between px-5 py-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-px w-4 bg-warning shrink-0" />
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Bulletin Board
                </span>
              </div>
              <DialogHeader>
                <DialogTitle
                  className="text-base font-bold text-primary-foreground"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                >
                  New Post
                </DialogTitle>
              </DialogHeader>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center text-primary-foreground/40 hover:text-primary-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Form body ── */}
        <div className="divide-y divide-border">

          {/* Title */}
          <div className="px-5 py-4">
            <FieldLabel required>Title</FieldLabel>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={MAX_TITLE}
              placeholder="e.g. Library closed on April 5"
              className={`${inputBase} h-10`}
            />
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground/50 tabular-nums"
              style={{ fontFamily: "var(--font-heading)" }}>
              {form.title.length}/{MAX_TITLE}
            </p>
          </div>

          {/* Excerpt */}
          <div className="px-5 py-4">
            <FieldLabel required>Excerpt</FieldLabel>
            <textarea
              name="excerpt"
              value={form.excerpt}
              onChange={handleChange}
              maxLength={MAX_EXCERPT}
              rows={2}
              placeholder="Short summary shown on post cards…"
              className={`${inputBase} py-2.5 resize-none`}
            />
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground/50 tabular-nums"
              style={{ fontFamily: "var(--font-heading)" }}>
              {form.excerpt.length}/{MAX_EXCERPT}
            </p>
          </div>

          {/* Full content */}
          <div className="px-5 py-4">
            <FieldLabel required>Full Content</FieldLabel>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={6}
              placeholder="Full post body…"
              className={`${inputBase} py-2.5 resize-none`}
            />
          </div>

          {/* Pin toggle — admins only */}
          {canPin && (
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Pin className="h-3.5 w-3.5 text-warning shrink-0" />
                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Pin this post
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Pinned posts appear at the top of the board.
                  </p>
                </div>
              </div>
              {/* Toggle — sharp track, no rounded-full */}
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, is_pinned: !prev.is_pinned }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  form.is_pinned ? "bg-warning" : "bg-muted-foreground/25"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 bg-white shadow transform transition-transform duration-200 ${
                    form.is_pinned ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Cover image */}
          <div className="px-5 py-4">
            <FieldLabel>Cover Image <span className="normal-case font-normal text-muted-foreground tracking-normal">(optional)</span></FieldLabel>

            {previewSrc ? (
              <div className="relative overflow-hidden border border-border bg-muted/30">
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="w-full object-contain"
                  style={{ maxHeight: "240px" }}
                />
                {/* Upload progress overlay */}
                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Uploading — {progress}%
                      </span>
                      <div className="h-[2px] w-32 bg-border overflow-hidden">
                        <div
                          className="h-full bg-warning transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {!uploading && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-full flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  Click to upload or paste (Ctrl+V)
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  JPEG, PNG, WebP · max 5 MB
                </span>
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

          {/* Error */}
          {error && (
            <div className="px-5 py-3 flex items-start gap-2.5 bg-destructive/[0.04] border-t border-destructive/20">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-[11px] text-destructive leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="flex border-t border-border">
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="flex-1 h-11 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground border-r border-border hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className="flex-1 h-11 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "Uploading…" : submitting ? "Publishing…" : "Publish Post"}
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
}