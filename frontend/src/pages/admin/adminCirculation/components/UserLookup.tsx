import { useEffect, useState } from "react";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "@/utils/AxiosInstance";
import type { UserInfo, ActiveBorrow, TransactionType, ClearanceStatus } from "../circulation.types";

interface Props {
  studentId: string;
  onStudentIdChange: (v: string) => void;
  onLookup: (studentIdOverride?: string) => void;
  lookingUp: boolean;
  foundUser: UserInfo | null;
  activeBorrows: ActiveBorrow[];
  type: TransactionType;
  clearance: ClearanceStatus | null;
}

type UserSuggestion = Pick<UserInfo, "student_employee_id" | "name" | "role">;

const UserLookup = ({
  studentId, onStudentIdChange, onLookup,
  lookingUp, foundUser, activeBorrows, type, clearance,
}: Props) => {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  useEffect(() => {
    const query = studentId.trim();
    if (query.length < 2 || foundUser?.student_employee_id === query) { setSuggestions([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await axiosInstance.get("/api/admin/users", { params: { student_employee_id: query, name: query } });
        if (active) setSuggestions(response.data.slice(0, 6));
      } catch { if (active) setSuggestions([]); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [studentId, foundUser?.student_employee_id]);

  return <div className="space-y-2">

    <label
      className="block text-sm font-medium text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Student / Employee ID or Name
    </label>

    {/* Input + search button fused */}
    <div className="flex gap-0 border border-border overflow-hidden focus-within:border-primary transition-colors">
      <input
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
        placeholder="Type a name, student ID, or employee ID"
        className="h-10 flex-1 bg-background px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />
      <button
        type="button"
        onClick={() => onLookup()}
        disabled={lookingUp || !studentId.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center border-l border-border bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {lookingUp
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Search className="h-4 w-4" />
        }
      </button>
    </div>

    {suggestions.length > 0 && (
      <div className="divide-y divide-border border border-border bg-card shadow-sm">
        {suggestions.map((user) => (
          <button key={user.student_employee_id} type="button" onClick={() => { setSuggestions([]); onLookup(user.student_employee_id); }} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{user.name}</span><span className="block font-mono text-[10px] text-muted-foreground">{user.student_employee_id}</span></span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{user.role}</span>
          </button>
        ))}
      </div>
    )}

    {/* Found user card */}
    {foundUser && (
      <div className="space-y-3">
      <div className="flex gap-0 border border-border overflow-hidden">
        {/* Gold left accent — user confirmed */}
        <div className="w-[3px] shrink-0 bg-warning/60" />

        <div className="flex min-w-0 flex-1 flex-col gap-3 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p
              className="text-base font-semibold text-foreground truncate leading-tight"
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
      {type === "borrow" && clearance?.status === "blocked" ? <div className="flex flex-col gap-3 border-l-4 border-destructive bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" /><div><p className="text-sm font-semibold text-destructive">Clearance required before borrowing</p>{clearance.reasons.map((reason) => <p key={reason} className="text-xs text-foreground">{reason}</p>)}</div></div><Link to={`/admin/clearance?student_employee_id=${encodeURIComponent(foundUser.student_employee_id)}`} className="text-sm font-medium text-primary underline underline-offset-4">Open Clearance</Link></div> : null}
      </div>
    )}
  </div>;
};

export default UserLookup;
