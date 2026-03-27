import { CheckCircle2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
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
    <Label>Book Copy QR Code</Label>
    <BarcodeInput
      value={copyBarcode}
      onChange={onCopyBarcodeChange}
      onSubmit={onLookup}
      loading={lookingUp}
      disabled={disabled}
      placeholder="Scan book QR code or type it"
    />

    {foundCopy && (
      <div className="rounded-lg border bg-card px-3 py-2.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{foundCopy.title}</p>
            <p className="text-xs text-muted-foreground">{foundCopy.author}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground font-mono">{foundCopy.barcode}</p>
            <p className={`text-xs font-medium ${
              foundCopy.is_active ? "text-success" : "text-destructive"
            }`}>
              {foundCopy.condition} · {foundCopy.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        </div>

        {type === "return" && (
          matchedBorrow ? (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Matched — due {new Date(matchedBorrow.due_date).toLocaleDateString()}
              {matchedBorrow.status === "overdue" && (
                <span className="ml-1 text-destructive font-medium">(overdue)</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              No active borrow for this user &amp; copy
            </div>
          )
        )}

        {type === "borrow" && !foundCopy.is_active && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            This copy is not available for borrowing
          </div>
        )}
      </div>
    )}
  </div>
);

export default BookLookup;