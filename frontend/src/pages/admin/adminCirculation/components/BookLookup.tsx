import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Search } from "lucide-react";
import BarcodeInput from "./BarcodeInput";
import axiosInstance from "@/utils/AxiosInstance";
import type { BookInfo, ActiveBorrow, TransactionType } from "../circulation.types";

interface Props {
  copyBarcode: string;
  onCopyBarcodeChange: (v: string) => void;
  onLookup: () => void;
  onSelectCopy: (barcode: string) => void;
  lookingUp: boolean;
  disabled: boolean;
  foundCopy: BookInfo | null;
  matchedBorrow: ActiveBorrow | null;
  type: TransactionType;
}

const BookLookup = ({
  copyBarcode, onCopyBarcodeChange, onLookup,
  lookingUp, disabled, onSelectCopy,
  foundCopy, matchedBorrow, type,
}: Props) => {
  const [catalogQuery, setCatalogQuery] = useState("");
  const [results, setResults] = useState<{ id: number; title: string; author?: string; material_type?: string }[]>([]);
  const [copies, setCopies] = useState<{ id: number; barcode: string; is_active: number; status?: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = catalogQuery.trim();
    if (query.length < 2) { setResults([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { const response = await axiosInstance.get("/api/admin/books", { params: { query } }); if (active) setResults(response.data.slice(0, 6)); }
      catch { if (active) setResults([]); }
      finally { if (active) setSearching(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [catalogQuery]);

  const chooseBook = async (book: { id: number; material_type?: string }) => {
    if (book.material_type === "thesis") return;
    setResults([]); setCopies([]); setSearching(true);
    try {
      const response = await axiosInstance.get(`/api/admin/books/${book.id}/copies`);
      setCopies(response.data.filter((copy: { is_active: number; status?: string }) => copy.is_active && copy.status !== "borrowed"));
    } finally { setSearching(false); }
  };

  return <div className="space-y-2">

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

    <div className="border-t border-border/70 pt-3">
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70" style={{ fontFamily: "var(--font-heading)" }}>Can’t scan? Search catalog</label>
      <div className="flex items-center gap-2 border border-border bg-background px-3 focus-within:border-primary">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by title, author, or ISBN" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        {searching && <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />}
      </div>
      {results.length > 0 && <div className="divide-y divide-border border border-t-0 border-border bg-card">{results.map((book) => <button type="button" key={book.id} onClick={() => void chooseBook(book)} disabled={book.material_type === "thesis"} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{book.title}</span><span className="block truncate text-[11px] text-muted-foreground">{book.author || "Unknown author"}</span></span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{book.material_type === "thesis" ? "Reference only" : "Select"}</span></button>)}</div>}
      {copies.length > 0 && <div className="mt-2 divide-y divide-border border border-border bg-card">{copies.map((copy) => <button type="button" key={copy.id} onClick={() => { setCopies([]); setCatalogQuery(""); onSelectCopy(copy.barcode); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40"><span className="font-mono text-xs text-foreground">{copy.barcode}</span><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-success">Available copy</span></button>)}</div>}
    </div>

    {/* Found copy card */}
    {foundCopy && (
      <div className="flex gap-0 border border-border overflow-hidden">
        {/* Status accent bar */}
        <div className={`w-[3px] shrink-0 ${foundCopy.is_active ? "bg-success/60" : "bg-destructive/50"}`} />

        <div className="min-w-0 flex-1 space-y-2 bg-card px-4 py-3">
          {/* Title + barcode */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
            <div className="min-w-0 text-left sm:shrink-0 sm:text-right">
              <p className="break-all font-mono text-[11px] text-muted-foreground/60">{foundCopy.barcode}</p>
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
  </div>;
};

export default BookLookup;
