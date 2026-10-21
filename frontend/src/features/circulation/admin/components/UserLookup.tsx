import { useQuery } from "@tanstack/react-query";
import { AdminIcon, searchAdminUsers } from "@/features/admin";
import { useDebounce } from "@/hooks/use-debounce";
import { circulationKeys } from "../circulation.keys";
import type { UserInfo } from "../circulation.types";

import CirculationScannerButton from "./CirculationScannerButton";

interface Props {
  studentId: string;
  onStudentIdChange: (value: string) => void;
  onLookup: (id?: string) => void;
  lookingUp: boolean;
  foundUser: UserInfo | null;
  disabled?: boolean;
}

export default function UserLookup({ studentId, onStudentIdChange, onLookup, lookingUp, foundUser, disabled }: Props) {
  const search = useDebounce(studentId.trim(), 180);
  const suggestions = useQuery({ queryKey: circulationKeys.userSuggestions(search), queryFn: ({ signal }) => searchAdminUsers(search, signal), enabled: search.length >= 2 && !foundUser && !lookingUp, staleTime: 15_000 });
  if (foundUser) return <div className="circulation-selection" aria-live="polite"><AdminIcon name="users" /><div><strong>{foundUser.name}</strong><span className="circulation-mono">{foundUser.student_employee_id}</span></div><button type="button" className="circulation-text-button" disabled={disabled} onClick={() => { onStudentIdChange(""); requestAnimationFrame(() => document.getElementById("circulation-patron")?.focus()); }}>Change patron</button></div>;
  return <div className="circulation-lookup">
    <label htmlFor="circulation-patron" className="sr-only">Student / employee ID or name</label>
    <div className="circulation-scan-field"><input id="circulation-patron" autoFocus autoComplete="off" value={studentId} disabled={disabled} onChange={e => onStudentIdChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !lookingUp && !disabled) { e.preventDefault(); onLookup(); } }} placeholder="Scan an ID or search by name" /><button type="button" aria-label="Find patron" disabled={disabled || lookingUp || !studentId.trim()} onClick={() => onLookup()}><AdminIcon name={lookingUp ? "refresh" : "search"} className={lookingUp ? "animate-spin" : ""} /></button></div>
    <CirculationScannerButton label="Scan patron ID" disabled={disabled||lookingUp} onScan={value=>{onStudentIdChange(value);onLookup(value);}}/>
    {suggestions.isError && <p role="alert" className="circulation-error">Could not load suggestions. Enter the exact ID to look up the patron, or <button type="button" onClick={() => void suggestions.refetch()}>retry</button>.</p>}
    {!foundUser && !lookingUp && (suggestions.data?.length ?? 0) > 0 && <div className="circulation-results">{suggestions.data!.slice(0, 6).map(user => <button type="button" key={user.student_employee_id} disabled={disabled} onClick={() => onLookup(user.student_employee_id)}><span><strong>{user.name}</strong><span className="circulation-mono">{user.student_employee_id}</span></span><span className="circulation-secondary">{user.role}</span></button>)}</div>}
  </div>;
}
