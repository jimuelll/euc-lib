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

    <label
      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Student / Employee ID
    </label>

    {/* Input + search button fused */}
    <div className="flex gap-0 border border-border overflow-hidden focus-within:border-primary transition-colors">
      <input
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
        placeholder="Enter student or employee ID"
        className="flex-1 h-9 px-3.5 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
      />
      <button
        type="button"
        onClick={onLookup}
        disabled={lookingUp || !studentId.trim()}
        className="flex items-center justify-center h-9 w-9 border-l border-border bg-primary text-primary-foreground shrink-0 hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {lookingUp
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Search className="h-3.5 w-3.5" />
        }
      </button>
    </div>

    {/* Found user card */}
    {foundUser && (
      <div className="flex gap-0 border border-border overflow-hidden">
        {/* Gold left accent — user confirmed */}
        <div className="w-[3px] shrink-0 bg-warning/60" />

        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p
              className="text-[13px] font-bold text-foreground truncate leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {foundUser.name}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
              {foundUser.student_employee_id}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
            {type === "return" && activeBorrows.length > 0 && (
              <div className="text-right">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Active Borrows
                </p>
                <p
                  className="text-base font-bold text-foreground leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {activeBorrows.length}
                </p>
              </div>
            )}
            {/* Role badge */}
            <span
              className="border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground capitalize"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {foundUser.role}
            </span>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default UserLookup;
