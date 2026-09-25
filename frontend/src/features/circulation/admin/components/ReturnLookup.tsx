import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import BarcodeInput from "./BarcodeInput";
import type { ReturnPreview, ReturnReceipt } from "../circulation.types";

interface Props {
  identifier: string;
  onIdentifierChange: (value: string) => void;
  onLookup: (identifier: string) => void;
  lookingUp: boolean;
  preview: ReturnPreview | null;
  receipt: ReturnReceipt | null;
  error: string;
}

const formatDateTime = (value: string) => new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-foreground">{children}</dd>
  </div>
);

const LoanDetails = ({ preview, returnedAt }: { preview: ReturnPreview; returnedAt?: string }) => (
  <div className="mt-4 border-t border-border pt-4">
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      <Detail label="Date borrowed">{formatDateTime(preview.borrowed_at)}</Detail>
      <Detail label="Due date">{formatDateTime(preview.due_date)}</Detail>
      {returnedAt ? <Detail label="Date returned">{formatDateTime(returnedAt)}</Detail> : null}
    </dl>
  </div>
);

const ReturnLookup = ({ identifier, onIdentifierChange, onLookup, lookingUp, preview, receipt, error }: Props) => (
  <div className="space-y-3">
    <label htmlFor="circulation-accession-input" className="block text-sm font-medium text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
      Accession number or copy QR code
    </label>
    <BarcodeInput
      inputId="circulation-accession-input"
      value={identifier}
      onChange={onIdentifierChange}
      onSubmit={onLookup}
      loading={lookingUp}
      disabled={Boolean(receipt)}
      placeholder="Type an accession number or scan a copy QR code"
    />

    {lookingUp ? <p role="status" className="text-sm text-muted-foreground">Looking up the active loan…</p> : null}
    {error ? (
      <div role="alert" className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    ) : null}

    {preview ? (
      <div aria-live="polite" className="border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Borrower information</p>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{preview.user_name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{preview.student_employee_id} <span className="mx-1.5">·</span> {preview.role}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold ${preview.status === "overdue" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"}`}>
            {preview.status === "overdue" ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {preview.status === "overdue" ? "Overdue" : "On loan"}
          </span>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Book information</p>
          <h4 className="mt-1 text-base font-semibold leading-snug text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{preview.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{preview.author || "Unknown author"}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Accession number">{preview.accession_number || "No accession number · QR return"}</Detail>
            <Detail label="Copy QR code"><span className="font-mono text-xs">{preview.copy_barcode}</span></Detail>
          </dl>
        </div>
        <LoanDetails preview={preview} />
      </div>
    ) : null}

    {receipt ? (
      <div role="status" className="border border-success/30 bg-success/5 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-semibold">Return recorded</p>
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Borrower</p>
          <p className="mt-1 text-sm font-medium text-foreground">{receipt.user_name} <span className="font-normal text-muted-foreground">· {receipt.student_employee_id}</span></p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Book</p>
          <p className="mt-1 text-sm font-medium text-foreground">{receipt.title}</p>
        </div>
        <LoanDetails preview={receipt} returnedAt={receipt.returned_at} />
      </div>
    ) : null}

  </div>
);

export default ReturnLookup;
