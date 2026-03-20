import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, User, CheckCircle2 } from "lucide-react";
import type { UserInfo, ActiveBorrow, TransactionType } from "../circulation.types";

interface Props {
  studentId: string;
  onStudentIdChange: (v: string) => void;
  onLookup: () => void;
  lookingUp: boolean;
  foundUser: UserInfo | null;
  activeBorrows: ActiveBorrow[];
  type: TransactionType;
}

const UserLookup = ({
  studentId, onStudentIdChange, onLookup,
  lookingUp, foundUser, activeBorrows, type,
}: Props) => (
  <div className="space-y-2">
    <Label>Student / Employee ID</Label>
    <div className="flex gap-2">
      <Input
        placeholder="e.g. A23-0255"
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
      />
      <Button
        type="button"
        variant="outline"
        onClick={onLookup}
        disabled={lookingUp || !studentId.trim()}
        className="shrink-0"
      >
        {lookingUp
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Search className="h-4 w-4" />
        }
      </Button>
    </div>

    {foundUser && (
      <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{foundUser.name}</p>
          <p className="text-xs text-muted-foreground">
            {foundUser.student_employee_id} · {foundUser.role}
          </p>
        </div>
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
      </div>
    )}

    {foundUser && activeBorrows.length > 0 && type !== "borrow" && (
      <div className="rounded-lg border bg-card divide-y">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
          Active borrows ({activeBorrows.length})
        </p>
        {activeBorrows.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{b.title}</p>
              <p className="text-xs text-muted-foreground">
                Due {new Date(b.due_date).toLocaleDateString()}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                b.status === "overdue"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-info/10 text-info border-info/20"
              }
            >
              {b.status === "overdue" ? "Overdue" : "Active"}
            </Badge>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default UserLookup;