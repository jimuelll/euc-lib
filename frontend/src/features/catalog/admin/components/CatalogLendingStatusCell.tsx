import { Button } from "@/components/ui/button";
import type { Book } from "../AdminCatalog.types";
import { getCatalogLendingStatus } from "../catalogLendingStatus";

type Props = {
  book: Book;
  archived: boolean;
  onAddHoldings: (book: Book) => void;
  onAssignPolicy: (book: Book) => void;
};

export default function CatalogLendingStatusCell({ book, archived, onAddHoldings, onAssignPolicy }: Props) {
  if (book.material_type === "thesis") return <span className="text-muted-foreground">Reference only</span>;

  if (Boolean(book.needs_policy)) return <>
    <span className="font-semibold text-warning">Needs loan policy</span>
    <p className="mt-1 text-xs text-muted-foreground">Lending is paused until an active policy is assigned.</p>
    {!archived && <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={(event) => { event.stopPropagation(); onAssignPolicy(book); }} onKeyDown={(event) => event.stopPropagation()}>Assign policy</Button>}
  </>;

  const status = getCatalogLendingStatus(book);
  return <>
    <span className={status.tone === "available" ? "font-semibold text-success" : "font-semibold text-foreground"}>{status.label}</span>
    <p className="mt-1 text-xs text-muted-foreground">{status.detail}</p>
    {!archived && status.needsHoldings && <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={(event) => { event.stopPropagation(); onAddHoldings(book); }} onKeyDown={(event) => event.stopPropagation()}>Add holdings</Button>}
  </>;
}
