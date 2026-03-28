import { useRef, useState } from "react";
import {
  AlertTriangle, Check, Eye, EyeOff, Loader2, X,
} from "lucide-react";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { FONT, LABEL_CLS } from "../subscriptions.styles";
import type { FormState, ModalMode } from "../subscriptions.types";
import { Field } from "./Field";
import { ImagePicker } from "./ImagePicker";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubscriptionModalProps {
  mode: ModalMode;
  initial: FormState;
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SubscriptionModal = ({
  mode,
  initial,
  onClose,
  onSave,
}: SubscriptionModalProps) => {
  const [form, setForm]     = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const backdropRef         = useRef<HTMLDivElement>(null);

  const { upload, uploading, progress } = useCloudinaryUpload();

  const set = <K extends keyof FormState>(key: K) =>
    (val: FormState[K]) => setForm((f) => ({ ...f, [key]: val }));

  const handleFileChange = (file: File) => {
    const preview = URL.createObjectURL(file);
    setForm((f) => ({
      ...f,
      imageFile:        file,
      imagePreview:     preview,
      removeImage:      false,
      uploadedImageUrl: null,
      uploadedPublicId: null,
    }));
  };

  const handleRemoveImage = () => {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm((f) => ({
      ...f,
      imageFile:        null,
      imagePreview:     null,
      removeImage:      true,
      uploadedImageUrl: null,
      uploadedPublicId: null,
    }));
  };

  const handleUndoRemove = () => setForm((f) => ({ ...f, removeImage: false }));

  const handleSave = async () => {
    if (!form.title.trim()) return setErr("Title is required.");
    if (!form.url.trim())   return setErr("URL is required.");

    try {
      setSaving(true);
      setErr(null);

      let finalForm = form;

      if (form.imageFile) {
        const result = await upload(form.imageFile);
        if (!result) throw new Error("Image upload failed. Please try again.");
        finalForm = {
          ...form,
          uploadedImageUrl: result.secure_url,
          uploadedPublicId: result.public_id,
        };
      }

      await onSave(finalForm);
      if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const isBusy      = uploading || saving;
  const buttonLabel = uploading
    ? `Uploading… ${progress}%`
    : saving
    ? "Saving…"
    : "Save";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg bg-card border border-border flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between shrink-0 relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-warning" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px w-3 bg-warning" />
              <span className={`${LABEL_CLS} text-warning text-[9px]`} style={FONT}>
                {mode === "create" ? "New Entry" : "Edit Entry"}
              </span>
            </div>
            <h2 className="text-base font-bold text-primary-foreground" style={FONT}>
              {mode === "create" ? "Add Subscription" : "Edit Subscription"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-primary-foreground/40 hover:text-primary-foreground transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field
            label="Title"
            value={form.title}
            onChange={set("title")}
            placeholder="e.g. IEEE Xplore"
            required
          />
          <Field
            label="URL"
            type="url"
            value={form.url}
            onChange={set("url")}
            placeholder="https://"
            required
          />
          <Field
            label="Category"
            value={form.category}
            onChange={set("category")}
            placeholder="e.g. Technology"
          />
          <Field
            label="Description"
            value={form.description}
            onChange={set("description")}
            placeholder="Brief description of the database…"
            multiline
          />

          <ImagePicker
            preview={form.imagePreview}
            existingUrl={form.existingImageUrl}
            removeImage={form.removeImage}
            onFileChange={handleFileChange}
            onRemove={handleRemoveImage}
            onUndo={handleUndoRemove}
          />

          {/* Upload progress bar */}
          {uploading && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1 w-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className={`${LABEL_CLS} text-[9px] text-muted-foreground/50`} style={FONT}>
                Uploading image… {progress}%
              </p>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between border border-border px-4 py-3">
            <div>
              <p className={`${LABEL_CLS} text-foreground`} style={FONT}>Visibility</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                {form.is_active ? "Visible on public page" : "Hidden from public page"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("is_active")(!form.is_active)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border transition-colors ${
                form.is_active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {form.is_active
                ? <Eye className="h-3.5 w-3.5" />
                : <EyeOff className="h-3.5 w-3.5" />}
              <span className={`${LABEL_CLS} text-[9px]`} style={FONT}>
                {form.is_active ? "Active" : "Hidden"}
              </span>
            </button>
          </div>

          {err && (
            <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3 shrink-0 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className={`${LABEL_CLS} px-4 py-2 border border-border bg-background text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50`}
            style={FONT}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className={`${LABEL_CLS} px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2`}
            style={FONT}
          >
            {isBusy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />}
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};