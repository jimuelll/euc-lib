import {
  BookOpen, ExternalLink, Eye, EyeOff, GripVertical, Pencil, Trash2,
} from "lucide-react";
import { FONT, LABEL_CLS } from "../subscriptions.styles";
import type { Subscription } from "../subscriptions.types";

// ─── Thumbnail ────────────────────────────────────────────────────────────────

const RowThumb = ({ imageUrl }: { imageUrl: string | null }) => (
  <div className="h-9 w-14 border border-border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0">
    {imageUrl ? (
      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <BookOpen className="h-3.5 w-3.5 text-muted-foreground/20" />
    )}
  </div>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubscriptionRowProps {
  sub: Subscription;
  index: number;
  onToggleActive: (sub: Subscription) => void;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SubscriptionRow = ({
  sub,
  index,
  onToggleActive,
  onEdit,
  onDelete,
}: SubscriptionRowProps) => (
  <div
    className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center px-4 sm:px-6 py-3 gap-4 transition-colors hover:bg-muted/30 ${
      index % 2 !== 0 ? "bg-muted/10" : ""
    }`}
  >
    <GripVertical className="h-4 w-4 text-muted-foreground/20 cursor-grab" />

    <RowThumb imageUrl={sub.image_url} />

    <div className="min-w-0">
      <p className="text-sm font-semibold text-foreground truncate" style={FONT}>
        {sub.title}
      </p>
      <a
        href={sub.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors truncate max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
        {sub.url}
      </a>
    </div>

    <span
      className="hidden sm:inline-block border border-border bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground whitespace-nowrap"
      style={FONT}
    >
      {sub.category || "—"}
    </span>

    <span
      className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border whitespace-nowrap ${
        sub.is_active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground/50"
      }`}
      style={FONT}
    >
      {sub.is_active ? "Active" : "Hidden"}
    </span>

    <div className="flex items-center gap-1">
      <button
        onClick={() => onToggleActive(sub)}
        title={sub.is_active ? "Hide" : "Show"}
        className="p-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        {sub.is_active
          ? <EyeOff className="h-3.5 w-3.5" />
          : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => onEdit(sub)}
        title="Edit"
        className="p-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onDelete(sub)}
        title="Delete"
        className="p-1.5 border border-destructive/30 bg-background hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);