import { AlertTriangle, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  <div className="content-subscription-table overflow-hidden">

    {/* Table header */}
    <div className="content-subscription-header">
      <div>
        {["Image", "Database", "Category", "Status", "Actions"].map((h) => (
          <span key={h} className="text-xs font-medium text-muted-foreground">
            {h}
          </span>
        ))}
      </div>
    </div>

    {/* States */}
    {loading && (
      <div className="space-y-2 bg-background p-4">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full rounded-md" />)}</div>
    )}

    {!loading && error && (
      <div className="flex items-center justify-center gap-3 py-20 text-destructive/70 bg-background">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    )}

    {!loading && !error && subs.length === 0 && (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <Globe className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          No subscriptions yet
        </p>
        <p className="text-sm text-muted-foreground">Add a resource to make it available on the library website.</p>
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
          className="text-xs text-muted-foreground "
        >
          {subs.length} {subs.length === 1 ? "record" : "records"} · {activeCount} active
        </p>
      </div>
    )}
  </div>
);
