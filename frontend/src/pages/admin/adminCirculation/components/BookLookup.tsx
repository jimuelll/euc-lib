import { CheckCircle2, AlertCircle } from "lucide-react";
import BarcodeInput from "./BarcodeInput";
import type { BookInfo, ActiveBorrow, TransactionType } from "../circulation.types";

interface Props {
  copyBarcode: string;
  onCopyBarcodeChange: (v: string) => void;
  onLookup: () => void;
  lookingUp: boolean;
  disabled: boolean;
  foundCopy: BookInfo | null;
  matchedBorrow: ActiveBorrow | null;
  type: TransactionType;
}

const BookLookup = ({
  copyBarcode, onCopyBarcodeChange, onLookup,
  lookingUp, disabled,
  foundCopy, matchedBorrow, type,
}: Props) => (
  <div className="space-y-2">

    {/* Field label */}
    <label
      className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Book Copy QR Code
    </label>

    <BarcodeInput
      value={copyBarcode}
      onChange={onCopyBarcodeChange}
      onSubmit={onLookup}
      loading={lookingUp}
      disabled={disabled}
      placeholder="Scan book QR code or type barcode"
    />

    {/* Found copy card */}
    {foundCopy && (
      <div className="flex gap-0 border border-border overflow-hidden">
        {/* Status accent bar */}
        <div className={`w-[3px] shrink-0 ${foundCopy.is_active ? "bg-success/60" : "bg-destructive/50"}`} />

        <div className="flex-1 px-4 py-3 space-y-2 bg-card">
          {/* Title + barcode */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[13px] font-bold text-foreground truncate leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {foundCopy.title}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 truncate"
                style={{ fontFamily: "var(--font-heading)" }}>
                {foundCopy.author}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-[11px] text-muted-foreground/60">{foundCopy.barcode}</p>
              <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                foundCopy.is_active ? "text-success" : "text-destructive"
              }`} style={{ fontFamily: "var(--font-heading)" }}>
                {foundCopy.condition} · {foundCopy.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          </div>

          {/* Return match / borrow availability */}
          {type === "return" && (
            matchedBorrow ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium">
                  Matched — due {new Date(matchedBorrow.due_date).toLocaleDateString()}
                  {matchedBorrow.status === "overdue" && (
                    <span className="ml-2 font-bold text-destructive">(Overdue)</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium">
                  No active borrow for this user &amp; copy
                </span>
              </div>
            )
          )}

          {type === "borrow" && !foundCopy.is_active && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium">
                This copy is not available for borrowing
              </span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default BookLookup;