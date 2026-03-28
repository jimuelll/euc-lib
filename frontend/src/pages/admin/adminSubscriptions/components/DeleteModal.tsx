import { useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { FONT, LABEL_CLS } from "../subscriptions.styles";
import type { Subscription } from "../subscriptions.types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DeleteModalProps {
  sub: Subscription;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DeleteModal = ({ sub, onClose, onConfirm }: DeleteModalProps) => {
  const [deleting, setDeleting] = useState(false);
  const backdropRef             = useRef<HTMLDivElement>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-sm bg-card border border-border">
        <div className="bg-destructive/10 border-b border-border px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <h2 className="text-sm font-bold text-foreground" style={FONT}>
            Delete Subscription
          </h2>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{sub.title}</span>?
            {sub.image_url && (
              <span className="block mt-1 text-[11px] text-muted-foreground/50">
                Its Cloudinary thumbnail will also be deleted.
              </span>
            )}
          </p>
        </div>

        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className={`${LABEL_CLS} px-4 py-2 border border-border bg-background text-muted-foreground hover:bg-muted transition-colors`}
            style={FONT}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className={`${LABEL_CLS} px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2`}
            style={FONT}
          >
            {deleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};