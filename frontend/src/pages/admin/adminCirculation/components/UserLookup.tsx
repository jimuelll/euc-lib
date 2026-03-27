import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
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
        placeholder="Enter student or employee ID"
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
      />
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={onLookup}
        disabled={lookingUp || !studentId.trim()}
      >
        {lookingUp
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Search className="h-4 w-4" />}
      </Button>
    </div>

    {foundUser && (
      <div className="rounded-lg border bg-card px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{foundUser.name}</p>
          <p className="text-xs text-muted-foreground">{foundUser.student_employee_id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {type === "return" && (
            <span className="text-xs text-muted-foreground">
              {activeBorrows.length} active borrow{activeBorrows.length !== 1 ? "s" : ""}
            </span>
          )}
          <Badge variant="outline" className="text-xs capitalize">{foundUser.role}</Badge>
        </div>
      </div>
    )}
  </div>
);

export default UserLookup;