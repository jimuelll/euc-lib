import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminConfirmDialog, formatPeso } from "@/features/admin";
import { fetchClearanceProfile, recordClearancePayment, adjustClearanceFine, clearanceKeys } from "@/features/clearance";
import { useAuth } from "@/context/AuthContext";
import { invalidateServerState } from "@/app/server-state";
import { getApiErrorMessage } from "@/utils/apiError";
import type { ReturnPreview } from "../circulation.types";

const currency = formatPeso;

export default function ReturnFineActions({ loan, disabled, onBusyChange }: { loan: ReturnPreview; disabled: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const { confirm, confirmDialog } = useAdminConfirmDialog();
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const profile = useQuery({ queryKey: clearanceKeys.profile(loan.student_employee_id), queryFn: ({ signal }) => fetchClearanceProfile(loan.student_employee_id, signal), staleTime: 0 });
  const fine = profile.data?.fineRows.find(row => row.id === loan.borrowing_id);
  const refresh = async () => { await invalidateServerState(client, "circulation"); await client.invalidateQueries({ queryKey: clearanceKeys.all }); };
  const payment = useMutation({ mutationFn: (amount: number) => recordClearancePayment(loan.student_employee_id, amount, amount), onSuccess: refresh });
  const waiver = useMutation({ mutationFn: () => adjustClearanceFine(loan.borrowing_id, fine!.unsettled_amount, reason.trim()), onSuccess: refresh });
  const busy = disabled || payment.isPending || waiver.isPending;
  const saving = payment.isPending || waiver.isPending;
  useEffect(() => { onBusyChange?.(saving); return () => onBusyChange?.(false); }, [saving, onBusyChange]);
  const collect = async () => {
    const confirmedAmount = profile.data?.outstandingAmount;
    if (confirmedAmount === undefined || busy || !await confirm({ title: "Record cash payment?", description: `Confirm that ${currency(confirmedAmount)} has been collected. This settles all outstanding fines for ${loan.user_name}. A receipt is generated after recording.`, actionLabel: "Record cash payment" })) return;
    setError("");
    try { await payment.mutateAsync(confirmedAmount); } catch (err) { setError(getApiErrorMessage(err, "Could not record payment. Please retry.")); }
  };
  const waive = async () => {
    if (!reason.trim() || busy || !fine || fine.unsettled_amount <= 0) return;
    setError("");
    try { await waiver.mutateAsync(); setWaiveOpen(false); setReason(""); } catch (err) { setError(getApiErrorMessage(err, "Could not waive the fine. Please retry.")); }
  };
  return <div className="circulation-fine">{confirmDialog}
    {profile.isPending ? <p role="status">Calculating fine…</p> : profile.isError ? <p role="alert" className="circulation-error">Fine unavailable. <button type="button" onClick={() => void profile.refetch()}>Retry</button> · You can still record the return.</p> : !fine ? <p className="circulation-secondary">Fine details unavailable. <Link to={`/admin/clearance?student_employee_id=${encodeURIComponent(loan.student_employee_id)}`}>Open clearance</Link></p> : <>
      <div className="circulation-fine-total"><span>Unpaid fine for this loan</span><strong className={fine.unsettled_amount > 0 ? "circulation-danger" : ""}>{currency(fine.unsettled_amount)}</strong></div>
      {fine.unsettled_amount > 0 && <div className="circulation-inline-actions"><Button variant="outline" disabled={busy || profile.isFetching} onClick={() => void collect()}>Collect all fines · {currency(profile.data!.outstandingAmount)}</Button>{(user?.role === "admin" || user?.role === "super_admin") && <Button id="circulation-waiver-open" variant="ghost" disabled={busy || profile.isFetching} onClick={() => { setError(""); setWaiveOpen(true); }}>Waive this fine</Button>}</div>}
      <p className="circulation-secondary">Fine accrual stops when the return is recorded.</p>
    </>}
    {error && !waiveOpen && <p role="alert" className="circulation-error">{error}</p>}
    <Dialog open={waiveOpen} onOpenChange={open => { if (!waiver.isPending) setWaiveOpen(open); }}><DialogContent className="circulation-dialog" onCloseAutoFocus={event => { event.preventDefault(); (document.getElementById("circulation-waiver-open") || document.getElementById("circulation-accession-input"))?.focus(); }}><DialogHeader><DialogTitle>Waive this loan’s fine</DialogTitle><DialogDescription>{fine ? currency(fine.unsettled_amount) : "Fine unavailable"} for {loan.title}. A reason is required for the audit record.</DialogDescription></DialogHeader><label htmlFor="circulation-waiver-reason">Reason</label><textarea id="circulation-waiver-reason" className="circulation-input" value={reason} onChange={e => setReason(e.target.value)} disabled={waiver.isPending} />{error && <p role="alert" className="circulation-error">{error}</p>}<Button disabled={busy || !reason.trim() || profile.isFetching} onClick={() => void waive()}>{waiver.isPending ? "Saving…" : "Confirm waiver"}</Button></DialogContent></Dialog>
  </div>;
}
