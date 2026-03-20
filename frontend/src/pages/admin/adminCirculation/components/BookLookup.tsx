import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import type { BookInfo, ActiveBorrow, TransactionType } from "../circulation.types";

interface Props {
  isbn: string;
  onIsbnChange: (v: string) => void;
  onLookup: () => void;
  lookingUp: boolean;
  disabled: boolean;
  foundBook: BookInfo | null;
  matchedBorrow: ActiveBorrow | null;
  type: TransactionType;
}

const BookLookup = ({
  isbn, onIsbnChange, onLookup,
  lookingUp, disabled,
  foundBook, matchedBorrow, type,
}: Props) => (
  <div className="space-y-2">
    <Label>Book ISBN</Label>
    <div className="flex gap-2">
      <Input
        placeholder="Enter ISBN"
        value={isbn}
        onChange={(e) => onIsbnChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookup())}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        onClick={onLookup}
        disabled={lookingUp || !isbn.trim() || disabled}
        className="shrink-0"
      >
        {lookingUp
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Search className="h-4 w-4" />
        }
      </Button>
    </div>

    {foundBook && (
      <div className="rounded-lg border bg-card px-3 py-2.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{foundBook.title}</p>
            <p className="text-xs text-muted-foreground">{foundBook.author}</p>
          </div>
          <span className={`shrink-0 text-xs font-medium ${
            foundBook.available > 0 ? "text-success" : "text-destructive"
          }`}>
            {foundBook.available}/{foundBook.copies} available
          </span>
        </div>

        {(type === "return" || type === "renew") && (
          matchedBorrow ? (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Matched borrow — due {new Date(matchedBorrow.due_date).toLocaleDateString()}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              No active borrow found for this user
            </div>
          )
        )}

        {type === "borrow" && foundBook.available === 0 && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            No copies available
          </div>
        )}
      </div>
    )}
  </div>
);

export default BookLookup;