import { useAuth } from "@/context/AuthContext";
import { isOperationsRole } from "@/utils/operationsAccess";
import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Sparkles, X } from "@/components/ui/library-glyphs";
import { CatalogueAvailability, CatalogueCover, CatalogueCompactCard } from "@/components/ui/catalogue-book";
import { RecommendationStrip } from "@/features/recommendations";
import type { PublicCatalogBook as Book, PublicCatalogSchemaField } from "../api";

const CORE_KEYS = new Set(["id", "title", "author", "isbn", "category", "edition", "publication_year", "publisher", "copies", "image_url"]);

export function CatalogueSimilarPanel({ book, onClose }: { book: Book; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const records = panel?.closest(".catalogue-records");
    const source = records?.querySelector<HTMLElement>(":scope > .catalogue-record.is-expanded");
    if (!panel || !source || !records) return;
    const anchor = records.classList.contains("is-grid") ? source : source.querySelector<HTMLElement>(".catalogue-cover");
    if (!anchor) return;
    const measure = () => {
      const bounds = anchor.getBoundingClientRect();
      panel.style.setProperty("--catalogue-source-centre", `${bounds.left + bounds.width / 2 - panel.getBoundingClientRect().left}px`);
      panel.dataset.connectorReady = "true";
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(source); observer?.observe(panel); observer?.observe(records);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [book.id]);
  return <div ref={panelRef} className="catalogue-similar" id={`recommendations-${book.id}`} role="region" aria-labelledby={`similar-title-${book.id}`}>
    <div className="catalogue-panel-header"><div><h2 id={`similar-title-${book.id}`}>{book.material_type === "thesis" ? "Related theses" : "Similar books"}</h2><p title={book.title}>{book.title}</p></div>
      <button type="button" className="catalogue-panel-close" aria-label="Close similar books" onClick={onClose}><X aria-hidden="true" /></button>
    </div>
    <RecommendationStrip seedBookId={book.id} materialType={book.material_type || "book"} compact />
  </div>;
}

export default function CatalogueResult({ book, schema, expanded, onToggle, onClose, grid = false }: { book: Book; schema: PublicCatalogSchemaField[]; expanded: boolean; onToggle: (trigger: HTMLButtonElement) => void; onClose: () => void; grid?: boolean }) {
  const { user } = useAuth();
  const reference = book.material_type === "thesis";
  const action = reference ? "View related theses" : "View similar books";
  const metadata = [book.isbn && "ISBN " + book.isbn, book.publisher, book.publication_year, book.edition && String(book.edition) + (/\bed\.?$/i.test(String(book.edition)) ? "" : " ed.")].filter(Boolean).map(String).join(" · ");
  const fields = schema.filter(field => field.public && !CORE_KEYS.has(field.key)).sort((a, b) => a.order - b.order).flatMap(field => {
    const value = book[field.key];
    return value == null || value === "" ? [] : [{ label: field.label, value: Array.isArray(value) ? value.join(", ") : String(value) }];
  });
  const control = { "aria-expanded": expanded, "aria-controls": `recommendations-${book.id}` };
  const reserve = !isOperationsRole(user?.role) && !reference && Number(book.canReserve) === 1 && Number(book.available) > 0 ? <Link className="catalogue-primary catalogue-reserve-action" to={`/services/borrowing?bookId=${book.id}`} aria-label={`Reserve ${book.title}`}>Reserve</Link> : null;
  if (grid) return <CatalogueCompactCard book={book} expanded={expanded} footerAction={reserve} coverAction={<button type="button" className="catalogue-cover-similar" aria-label={`View books similar to ${book.title}`} {...control} onClick={event => onToggle(event.currentTarget)}><Sparkles aria-hidden="true" /></button>} />;
  return <article className={"catalogue-record " + (expanded ? "is-expanded" : "")}>
    <CatalogueCover book={book} />
    <div className="catalogue-record-copy">
      <h2 title={book.title}><button type="button" onClick={event => onToggle(event.currentTarget)} {...control}>{book.title}</button></h2>
      <div className="catalogue-author" title={[book.author || "Unknown author", book.category].filter(Boolean).join(" · ")}>{book.author || "Unknown author"}{book.category && book.category !== "Uncategorized" && <> · <b>{book.category}</b></>}</div>
      {!grid && <>{metadata && <p className="catalogue-metadata">{metadata}</p>}
        {fields.length > 0 && <dl className="catalogue-extra-fields">{fields.map(field => <div key={field.label}><dt>{field.label}:</dt><dd>{field.value}</dd></div>)}</dl>}
        <div className="catalogue-record-actions"><button type="button" className="catalogue-similar-action" aria-label={action + " for " + book.title} {...control} onClick={event => onToggle(event.currentTarget)}>{action}<ChevronDown aria-hidden="true" /></button></div>
      </>}
    </div>
    <div className="catalogue-record-side">
      <CatalogueAvailability book={book} />
      {reserve}
    </div>
    {!grid && expanded && <CatalogueSimilarPanel book={book} onClose={onClose} />}
  </article>;
}
