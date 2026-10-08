import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminIcon } from "@/features/admin";
import { lookupUser, type LookupUserResult } from "../circulation.api";
import { circulationKeys } from "../circulation.keys";
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
export default function CirculationPatronCard({ patron, returnPatronId }: { patron?: LookupUserResult; returnPatronId?: string }) {
  const query = useQuery({ queryKey: circulationKeys.user(returnPatronId || ""), queryFn: ({ signal }) => lookupUser(returnPatronId!, signal), enabled: Boolean(returnPatronId), staleTime: 0 });
  const data = returnPatronId ? query.data : patron;
  if (!data) return returnPatronId ? <p className="circulation-secondary" role={query.isError ? "alert" : "status"}>{query.isError ? <>Patron account unavailable. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></> : "Loading patron account…"}</p> : null;
  return <div className="circulation-patron-card">{returnPatronId && <div className="circulation-patron-heading"><AdminIcon name="users" /><div><strong>{data.user.name}</strong><span className="circulation-mono">{data.user.student_employee_id}</span></div><span className="circulation-secondary">{data.user.role}</span></div>}<dl className="circulation-patron-metrics"><div><dt>Active loans</dt><dd>{data.activeBorrows.length}</dd></div><div data-warning={Boolean(data.clearance?.overdueItems.length)}><dt>Overdue</dt><dd>{data.clearance?.overdueItems.length ?? "—"}</dd></div><div data-warning={Boolean(data.clearance?.outstandingAmount)}><dt>Unpaid fines</dt><dd>{data.clearance ? money(data.clearance.outstandingAmount) : "Unavailable"}</dd></div></dl>{data.clearance?.status === "blocked" && <div className="circulation-patron-warning"><AdminIcon name="warning" /><div><strong>{returnPatronId ? "Account needs attention" : "Borrowing blocked"}</strong>{data.clearance.reasons.map(reason => <p key={reason}>{reason}</p>)}<Link to={`/admin/clearance?student_employee_id=${encodeURIComponent(data.user.student_employee_id)}`}>Review clearance</Link>{returnPatronId && <p>Returns can still be recorded. Unpaid fines remain on the account.</p>}</div></div>}</div>;
}
