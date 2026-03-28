import { useRef } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { FONT, LABEL_CLS } from "../subscriptions.styles";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImagePickerProps {
  preview: string | null;
  existingUrl: string | null;
  removeImage: boolean;
  onFileChange: (file: File) => void;
  onRemove: () => void;
  onUndo: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ImagePicker = ({
  preview,
  existingUrl,
  removeImage,
  onFileChange,
  onRemove,
  onUndo,
}: ImagePickerProps) => {
  const inputRef   = useRef<HTMLInputElement>(null);
  const displaySrc = preview ?? (removeImage ? null : existingUrl);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFileChange(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className={`${LABEL_CLS} text-muted-foreground`} style={FONT}>
        Thumbnail Image
        <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/40">
          (optional)
        </span>
      </label>

      {displaySrc ? (
        <div className="relative border border-border overflow-hidden group">
          <img src={displaySrc} alt="Preview" className="w-full h-32 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-background/90 hover:bg-background text-foreground border border-border transition-colors ${LABEL_CLS} text-[9px]`}
              style={FONT}
            >
              <Upload className="h-3 w-3" />
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-destructive/90 hover:bg-destructive text-destructive-foreground border border-destructive/50 transition-colors ${LABEL_CLS} text-[9px]`}
              style={FONT}
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
          {preview && (
            <span
              className={`absolute top-2 right-2 bg-warning text-warning-foreground px-2 py-0.5 ${LABEL_CLS} text-[9px]`}
              style={FONT}
            >
              New
            </span>
          )}
        </div>
      ) : removeImage ? (
        <div className="border border-dashed border-destructive/40 bg-destructive/5 flex flex-col items-center justify-center gap-2 py-6">
          <X className="h-6 w-6 text-destructive/40" />
          <p className={`${LABEL_CLS} text-[9px] text-destructive/60`} style={FONT}>
            Image will be removed
          </p>
          <button
            type="button"
            onClick={onUndo}
            className={`${LABEL_CLS} text-[9px] underline text-muted-foreground hover:text-foreground`}
            style={FONT}
          >
            Undo
          </button>
        </div>
      ) : (
        <div
          className="border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2 py-8 cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <ImageIcon className="h-7 w-7 text-muted-foreground/25" />
          <div className="text-center">
            <p className={`${LABEL_CLS} text-[9px] text-muted-foreground/60`} style={FONT}>
              Click or drag & drop
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">
              JPG, PNG, WEBP · max 5 MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChange(file);
          e.target.value = "";
        }}
      />
    </div>
  );
};