import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Search } from "lucide-react";
import BarcodeInput from "./BarcodeInput";
import type { BookInfo, ActiveBorrow, TransactionType } from "../circulation.types";
import { fetchCirculationBookCopies, searchCirculationBooks } from "../circulation.api";
import { circulationKeys } from "../circulation.keys";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorMessage } from "@/utils/apiError";

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
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const debouncedCatalogQuery = useDebounce(catalogQuery.trim(), 180);
  const resultsQuery = useQuery({
    queryKey: circulationKeys.catalogSearch(debouncedCatalogQuery),
    queryFn: ({ signal }) => searchCirculationBooks(debouncedCatalogQuery, signal),
    enabled: debouncedCatalogQuery.length >= 2,
  });
  const copiesQuery = useQuery({
    queryKey: circulationKeys.bookCopies(selectedBookId ?? 0, type),
    queryFn: ({ signal }) => fetchCirculationBookCopies(selectedBookId!, signal),
    enabled: selectedBookId !== null,
    select: (data) => data.filter((copy) => copy.is_active && (type === "return" ? copy.status === "borrowed" : copy.status !== "borrowed")),
  });
  const results = selectedBookId === null ? resultsQuery.data ?? [] : [];
  const copies = copiesQuery.data ?? [];
  const searching = resultsQuery.isFetching || copiesQuery.isFetching;
  const borrowEligibility = foundCopy
    ? !foundCopy.is_active
      ? { label: "Inactive copy · unavailable for checkout", eligible: false }
      : foundCopy.accession_voided
        ? { label: "Accession voided · unavailable for checkout", eligible: false }
        : foundCopy.needs_policy
        ? { label: "Needs loan policy", eligible: false }
        : !foundCopy.accession_number
          ? { label: "Needs accession number", eligible: false }
          : foundCopy.condition === "lost"
            ? { label: "Lost copy · unavailable for checkout", eligible: false }
            : foundCopy.has_active_loan
              ? { label: "Currently borrowed", eligible: false }
              : foundCopy.is_reserved
                ? { label: "Prepared for a reservation", eligible: false }
            : foundCopy.borrow_eligible === false || foundCopy.borrow_eligible === 0
              ? { label: "Not eligible for checkout", eligible: false }
              : { label: "Eligible for checkout", eligible: true }
    : null;

  const chooseBook = (book: { id: number; material_type?: string }) => {
    if (book.material_type === "thesis") return;
    setSelectedBookId(book.id);
  };

  return <div className="space-y-2">

    {/* Field label */}
    <label
      className="block text-sm font-medium text-muted-foreground"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      Accession number or copy QR code
    </label>

    <BarcodeInput
      value={copyBarcode}
      onChange={onCopyBarcodeChange}
      onSubmit={onLookup}
      loading={lookingUp}
      disabled={disabled}
      placeholder="Type an accession number or scan a copy QR code"
    />

    <div className="border-t border-border/70 pt-3">
      <label className="mb-2 block text-sm font-medium text-muted-foreground">Can’t scan? Search catalog</label>
      <div className="flex items-center gap-2 border border-border bg-background px-3 focus-within:border-primary">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search by title, author, or ISBN" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {searching && <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />}
      </div>
      {resultsQuery.isError ? <p role="alert" className="mt-2 text-sm text-destructive">{getApiErrorMessage(resultsQuery.error, "Could not search the catalog.")} <button type="button" className="underline" onClick={() => void resultsQuery.refetch()}>Try again</button></p> : null}
      {results.length > 0 && <div className="divide-y divide-border border border-t-0 border-border bg-card">{results.map((book) => <button type="button" key={book.id} onClick={() => chooseBook(book)} disabled={book.material_type === "thesis"} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{book.title}</span><span className="block truncate text-xs text-muted-foreground">{book.author || "Unknown author"}</span></span><span className="text-xs  text-muted-foreground">{book.material_type === "thesis" ? "Reference only" : "Select"}</span></button>)}</div>}
      {copiesQuery.isError ? <p role="alert" className="mt-2 text-sm text-destructive">{getApiErrorMessage(copiesQuery.error, "Could not load copies. Try another search.")} <button type="button" className="underline" onClick={() => void copiesQuery.refetch()}>Try again</button></p> : null}
      {copies.length > 0 && <div className="mt-2 divide-y divide-border border border-border bg-card">{copies.map((copy) => { const eligibility = copy.status === "borrowed" ? "Borrowed copy" : copy.status === "reserved" ? "Reserved copy" : copy.accession_voided ? "Accession voided" : copy.needs_policy ? "Needs loan policy" : !copy.accession_number ? "Needs accession" : copy.borrow_eligible === false || copy.borrow_eligible === 0 ? "Not lendable" : "Available copy"; return <button type="button" key={copy.id} onClick={() => { setSelectedBookId(null); setCatalogQuery(""); onSelectCopy(copy.barcode); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40"><span className="min-w-0"><span className="block font-mono text-xs text-foreground">{copy.barcode}</span><span className="mt-1 block text-xs text-muted-foreground">{copy.accession_number ? `Accession ${copy.accession_number}` : "No accession number"}</span></span><span className={`shrink-0 text-xs font-bold ${eligibility.includes("Borrowed") ? "text-info" : eligibility === "Available copy" ? "text-success" : "text-warning"}`}>{eligibility}</span></button>; })}</div>}
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
                className="text-base font-semibold text-foreground truncate leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {foundCopy.title}
              </p>
              <p className="mt-0.5 text-xs  text-muted-foreground truncate"
                style={{ fontFamily: "var(--font-heading)" }}>
                {foundCopy.author}
              </p>
            </div>
            <div className="min-w-0 text-left sm:shrink-0 sm:text-right">
              <p className="break-all font-mono text-xs text-muted-foreground">{foundCopy.barcode}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{foundCopy.accession_number ? `Accession ${foundCopy.accession_number}` : "No accession number"}</p>
              <p className={`mt-0.5 text-xs font-bold  ${
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
                <span className="text-xs font-medium">
                  Matched — due {new Date(matchedBorrow.due_date).toLocaleDateString()}
                  {matchedBorrow.status === "overdue" && (
                    <span className="ml-2 font-bold text-destructive">(Overdue)</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs font-medium">
                  No active borrow for this user &amp; copy
                </span>
              </div>
            )
          )}

          {type === "borrow" && borrowEligibility && (
            <div className={`flex items-center gap-2 ${borrowEligibility.eligible ? "text-success" : "text-warning"}`}>
              {borrowEligibility.eligible
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              <span className="text-xs font-medium">{borrowEligibility.label}</span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>;
};

export default BookLookup;
