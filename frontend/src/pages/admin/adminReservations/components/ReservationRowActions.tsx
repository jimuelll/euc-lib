import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReservationStatus } from "../reservations.types";

interface ReservationRowActionsProps {
  id:        number;
  title:     string;
  status:    ReservationStatus;
  isActing:  boolean;
  onMarkReady: (id: number, title: string) => void;
  onFulfill:   (id: number, title: string) => void;
  onCancel:    (id: number, title: string) => void;
}

const ReservationRowActions = ({
  id,
  title,
  status,
  isActing,
  onMarkReady,
  onFulfill,
  onCancel,
}: ReservationRowActionsProps) => {
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs bg-success hover:bg-success/90 text-white gap-1"
          disabled={isActing}
          onClick={() => onMarkReady(id, title)}
        >
          {isActing
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          Mark Ready
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
          disabled={isActing}
          onClick={() => onCancel(id, title)}
        >
          <XCircle className="h-3 w-3" />
          Cancel
        </Button>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs gap-1"
          disabled={isActing}
          onClick={() => onFulfill(id, title)}
        >
          {isActing
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          Fulfil
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
          disabled={isActing}
          onClick={() => onCancel(id, title)}
        >
          <XCircle className="h-3 w-3" />
          Cancel
        </Button>
      </div>
    );
  }

  // fulfilled / cancelled / expired — read-only
  return <span className="text-xs text-muted-foreground/50 italic">—</span>;
};

export default ReservationRowActions;