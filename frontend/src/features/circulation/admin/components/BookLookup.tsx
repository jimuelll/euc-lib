import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminIcon } from "@/features/admin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorMessage } from "@/utils/apiError";
import BarcodeInput from "./BarcodeInput";
import { fetchCirculationBookCopies, searchCirculationBooks } from "../circulation.api";
import { circulationKeys } from "../circulation.keys";
import type { BookInfo } from "../circulation.types";

interface Props {
  copyBarcode: string; onCopyBarcodeChange: (value: string) => void; onLookup: (value?: string) => void; onSelectCopy: (value: string) => void;
  lookingUp: boolean; disabled: boolean; foundCopy: BookInfo | null;
}
export default function BookLookup({ copyBarcode, onCopyBarcodeChange, onLookup, onSelectCopy, lookingUp, disabled, foundCopy }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [bookId, setBookId] = useState<number | null>(null);
  const query = useDebounce(search.trim(), 180);
  const books = useQuery({ queryKey: circulationKeys.catalogSearch(query), queryFn: ({ signal }) => searchCirculationBooks(query, signal), enabled: open && query.length >= 2 && bookId === null });
  const copies = useQuery({ queryKey: circulationKeys.bookCopies(bookId ?? 0, "borrow"), queryFn: ({ signal }) => fetchCirculationBookCopies(bookId!, signal), enabled: open && bookId !== null });
  return <div className="circulation-lookup">
    <label htmlFor="circulation-copy-input" className="sr-only">Accession number or copy QR code</label>
    <BarcodeInput inputId="circulation-copy-input" value={copyBarcode} onChange={onCopyBarcodeChange} onSubmit={onLookup} loading={lookingUp} disabled={disabled} placeholder="Scan or type an accession number" />
    <button type="button" id="circulation-catalog-open" className="circulation-secondary-button" disabled={disabled} onClick={() => setOpen(true)}><AdminIcon name="search" />Search catalog</button>
    {foundCopy && <div className="circulation-selection"><AdminIcon name="catalog" /><div><strong>{foundCopy.title}</strong><span className="circulation-secondary">{foundCopy.accession_number ? `Accession ${foundCopy.accession_number}` : "No accession number"} · {foundCopy.condition}</span></div></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="circulation-dialog sm:max-w-xl" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("circulation-catalog-open")?.focus(); }}><DialogHeader><DialogTitle>Search catalog</DialogTitle><DialogDescription>Choose a book, then select its copy for checkout.</DialogDescription></DialogHeader>
      <label htmlFor="circulation-catalog-search">Title, author, or ISBN</label><input id="circulation-catalog-search" className="circulation-input" value={search} onChange={e => { setSearch(e.target.value); setBookId(null); }} placeholder="Search the catalog" />
      {bookId !== null && <button type="button" className="circulation-text-button" onClick={() => setBookId(null)}>Back to results</button>}
      {(bookId === null ? books : copies).isFetching && <p role="status">Loading {bookId === null ? "books" : "copies"}…</p>}
      {(bookId === null ? books : copies).isError && <p role="alert" className="circulation-error">{getApiErrorMessage((bookId === null ? books : copies).error, "Could not load results.")} <button type="button" onClick={() => void (bookId === null ? books : copies).refetch()}>Retry</button></p>}
      <div className="circulation-results circulation-catalog-results">
        {bookId === null ? books.data?.map(book => <button type="button" key={book.id} disabled={book.material_type === "thesis"} onClick={() => setBookId(book.id)}><span><strong>{book.title}</strong><span className="circulation-secondary">{book.author || "Unknown author"}</span></span><span className="circulation-secondary">{book.material_type === "thesis" ? "Reference only" : "View copies"}</span></button>) : copies.data?.filter(copy => copy.is_active).map(copy => <button type="button" key={copy.id} disabled={disabled || copy.status === "borrowed" || copy.borrow_eligible === false || copy.borrow_eligible === 0} onClick={() => { onSelectCopy(copy.barcode); setOpen(false); }}><span><strong className="circulation-mono">{copy.accession_number || copy.barcode}</strong><span className="circulation-secondary">{copy.barcode}</span></span><span>{copy.status === "borrowed" ? "On loan" : copy.status === "reserved" ? "Reserved" : !copy.accession_number ? "Needs accession" : copy.needs_policy ? "Needs policy" : "Available"}</span></button>)}
      </div>
      {bookId === null && query.length >= 2 && books.isSuccess && !books.isFetching && books.data.length === 0 && <p>No books found.</p>}
      {bookId !== null && copies.isSuccess && !copies.isFetching && !copies.data.some(copy => copy.is_active) && <p>No active copies found.</p>}
    </DialogContent></Dialog>
  </div>;
}
