import { AlertTriangle, Globe, Loader2 } from "lucide-react";
import { FONT, LABEL_CLS } from "../subscriptions.styles";
import type { Subscription } from "../subscriptions.types";
import { SubscriptionRow } from "./SubscriptionRow";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubscriptionTableProps {
  subs: Subscription[];
  loading: boolean;
  error: string | null;
  activeCount: number;
  onToggleActive: (sub: Subscription) => void;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SubscriptionTable = ({
  subs,
  loading,
  error,
  activeCount,
  onToggleActive,
  onEdit,
  onDelete,
}: SubscriptionTableProps) => (
  <div className="border border-border overflow-hidden">

    {/* Table header */}
    <div className="bg-primary">
      <div className="h-[2px] w-full bg-warning" />
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] px-4 sm:px-6 py-3 gap-4 items-center">
        {["", "Image", "Database", "Category", "Status", "Actions"].map((h) => (
          <span key={h} className={`${LABEL_CLS} text-primary-foreground/40`} style={FONT}>
            {h}
          </span>
        ))}
      </div>
    </div>

    {/* States */}
    {loading && (
      <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground bg-background">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className={LABEL_CLS} style={FONT}>Loading…</span>
      </div>
    )}

    {!loading && error && (
      <div className="flex items-center justify-center gap-3 py-20 text-destructive/70 bg-background">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    )}

    {!loading && !error && subs.length === 0 && (
      <div className="flex flex-col items-center justify-center gap-2 py-20 bg-background">
        <Globe className="h-8 w-8 text-muted-foreground/20" />
        <p className={`${LABEL_CLS} text-muted-foreground/30`} style={FONT}>
          No subscriptions yet
        </p>
      </div>
    )}

    {/* Rows */}
    {!loading && !error && subs.length > 0 && (
      <div className="divide-y divide-border bg-background">
        {subs.map((sub, i) => (
          <SubscriptionRow
            key={sub.id}
            sub={sub}
            index={i}
            onToggleActive={onToggleActive}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    )}

    {/* Footer */}
    {!loading && !error && subs.length > 0 && (
      <div className="border-t border-border bg-muted/10 px-4 sm:px-6 py-3">
        <p
          className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em]"
          style={FONT}
        >
          {subs.length} {subs.length === 1 ? "record" : "records"} · {activeCount} active
        </p>
      </div>
    )}
  </div>
);