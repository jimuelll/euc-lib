import { CheckCircle2, XCircle, Loader2, Trash2, ArchiveRestore } from "lucide-react";
import type { ReservationStatus } from "../reservations.types";

interface ReservationRowActionsProps {
  id:           number;
  title:        string;
  status:       ReservationStatus;
  isActing:     boolean;
  showArchived: boolean;
  onMarkReady:  (id: number, title: string) => void;
  onFulfill:    (id: number, title: string) => void;
  onCancel:     (id: number, title: string) => void;
  onArchive:    (id: number, title: string) => void;
  onRestore:    (id: number, title: string) => void;
}

const ActionBtn = ({
  onClick, disabled, variant, children,
}: {
  onClick:  () => void;
  disabled: boolean;
  variant:  "primary" | "success" | "danger" | "ghost" | "warning";
  children: React.ReactNode;
}) => {
  const colors: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    success: "bg-success text-success-foreground hover:bg-success/90",
    danger:  "border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground",
    ghost:   "border border-border text-muted-foreground/50 hover:border-destructive/40 hover:text-destructive",
    warning: "border border-warning/40 text-warning hover:bg-warning hover:text-warning-foreground",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-40 ${colors[variant]}`}
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </button>
  );
};

const ReservationRowActions = ({
  id, title, status, isActing, showArchived,
  onMarkReady, onFulfill, onCancel, onArchive, onRestore,
}: ReservationRowActionsProps) => {

  // ── Archived view: only show Restore ──────────────────────────────────────
  if (showArchived) {
    return (
      <ActionBtn
        variant="warning"
        disabled={isActing}
        onClick={() => onRestore(id, title)}
      >
        {isActing
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <ArchiveRestore className="h-3 w-3" />
        }
        Restore
      </ActionBtn>
    );
  }

  // ── Active view ───────────────────────────────────────────────────────────

  if (status === "pending") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <ActionBtn
          variant="success"
          disabled={isActing}
          onClick={() => onMarkReady(id, title)}
        >
          {isActing
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          Mark Ready
        </ActionBtn>
        <ActionBtn
          variant="danger"
          disabled={isActing}
          onClick={() => onCancel(id, title)}
        >
          <XCircle className="h-3 w-3" />
          Cancel
        </ActionBtn>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <ActionBtn
          variant="primary"
          disabled={isActing}
          onClick={() => onFulfill(id, title)}
        >
          {isActing
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          Fulfil
        </ActionBtn>
        <ActionBtn
          variant="danger"
          disabled={isActing}
          onClick={() => onCancel(id, title)}
        >
          <XCircle className="h-3 w-3" />
          Cancel
        </ActionBtn>
      </div>
    );
  }

  // fulfilled / cancelled / expired — show Archive button
  return (
    <ActionBtn
      variant="ghost"
      disabled={isActing}
      onClick={() => onArchive(id, title)}
    >
      {isActing
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Trash2 className="h-3 w-3" />
      }
      Archive
    </ActionBtn>
  );
};

export default ReservationRowActions;