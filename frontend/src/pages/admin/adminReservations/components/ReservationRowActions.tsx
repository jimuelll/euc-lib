import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { ReservationStatus } from "../reservations.types";

interface ReservationRowActionsProps {
  id:          number;
  title:       string;
  status:      ReservationStatus;
  isActing:    boolean;
  onMarkReady: (id: number, title: string) => void;
  onFulfill:   (id: number, title: string) => void;
  onCancel:    (id: number, title: string) => void;
}

const ActionBtn = ({
  onClick, disabled, variant, children,
}: {
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "success" | "danger";
  children: React.ReactNode;
}) => {
  const colors = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    success: "bg-success text-success-foreground hover:bg-success/90",
    danger:  "border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground",
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
  id, title, status, isActing,
  onMarkReady, onFulfill, onCancel,
}: ReservationRowActionsProps) => {

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

  // fulfilled / cancelled / expired
  return <span className="text-muted-foreground/25">—</span>;
};

export default ReservationRowActions;