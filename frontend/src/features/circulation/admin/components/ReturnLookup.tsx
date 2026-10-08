import { useEffect } from "react";
import { AdminIcon } from "@/features/admin";
import BarcodeInput from "./BarcodeInput";
import ReturnFineActions from "./ReturnFineActions";
import type { ReturnPreview, ReturnReceipt } from "../circulation.types";

export default function ReturnLookup({ identifier, onIdentifierChange, onLookup, onConfirm, lookingUp, submitting, preview, receipt, error, onFineBusyChange }: {
  identifier: string; onIdentifierChange: (value: string) => void; onLookup: (value: string) => void; onConfirm: () => void;
  lookingUp: boolean; submitting: boolean; preview: ReturnPreview | null; receipt: ReturnReceipt | null; error: string;
  onFineBusyChange?: (busy: boolean) => void;
}) {
  useEffect(() => { if (receipt) document.getElementById("circulation-accession-input")?.focus(); }, [receipt]);
  return <div className="circulation-lookup"><label htmlFor="circulation-accession-input">Accession number or copy QR code</label>
    <BarcodeInput inputId="circulation-accession-input" autoFocus value={identifier} onChange={onIdentifierChange} onSubmit={value => { if (preview && value.trim() === identifier.trim()) onConfirm(); else onLookup(value); }} loading={lookingUp} disabled={submitting} placeholder="Scan or type a copy identifier" />
    <p className="circulation-secondary">Scan to identify the loan. Press Enter again to confirm its return.</p>
    {lookingUp && <p role="status">Finding the active loan…</p>}
    {error && <p role="alert" className="circulation-error"><AdminIcon name="warning" />{error}</p>}
    {preview && <article className="circulation-return-result" aria-live="polite"><div className="circulation-selection"><AdminIcon name="return" /><div><strong>{preview.title}</strong><span>{preview.user_name} · <span className="circulation-mono">{preview.student_employee_id}</span></span></div></div><dl className="circulation-result-details"><div><dt>Copy</dt><dd>{preview.accession_number || preview.copy_barcode}</dd></div><div><dt>Due</dt><dd>{new Date(preview.due_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</dd></div><div><dt>Overdue</dt><dd className={preview.status === "overdue" ? "circulation-danger" : ""}>{preview.status === "overdue" ? `${Math.max(1, Math.ceil((Date.now() - new Date(preview.due_date).getTime()) / 86_400_000))} days` : "On time"}</dd></div></dl><ReturnFineActions key={preview.borrowing_id} loan={preview} disabled={submitting} onBusyChange={onFineBusyChange} /></article>}
    {receipt && !preview && <p role="status" className="circulation-success"><AdminIcon name="return" />Return recorded. Scan the next copy.</p>}
  </div>;
}
