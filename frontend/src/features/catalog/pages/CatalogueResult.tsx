import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "@/components/ui/library-glyphs";
import { RecommendationStrip } from "@/features/recommendations";
import type { PublicCatalogBook as Book, PublicCatalogSchemaField } from "../api";

const palette = ["#7a0000", "#5c1a1a", "#3d2b3d", "#4a2c1c", "#2b3a42", "#5a4a1a"];
const CORE_KEYS = new Set(["id", "title", "author", "isbn", "category", "edition", "publication_year", "publisher", "copies", "image_url"]);

function BookCover({ book }: { book: Book }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [book.image_url]);
  const initials = book.title.replace(/^(the|a)\s/i, "").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <div className="catalogue-cover" style={{ "--catalogue-cover-color": palette[(book.title.length + book.id) % palette.length] } as CSSProperties} aria-hidden="true">
    {book.image_url && book.material_type !== "thesis" && !failed ? <img src={book.image_url} alt="" onError={() => setFailed(true)} loading="lazy" /> : <span>{initials}</span>}
  </div>;
}

function Availability({ book }: { book: Book }) {
  if (book.material_type === "thesis") return <div className="catalogue-status is-reference"><strong>Reference only</strong><span>Thesis · In-library use</span></div>;
  const available = Math.max(0, Number(book.available) || 0);
  const total = book.registered_copies == null ? null : Math.max(0, Number(book.registered_copies) || 0);
  if (total === 0) return <div className="catalogue-status is-unheld"><strong>Not yet on the shelf</strong><span>No copies accessioned</span></div>;
  return <div className={"catalogue-status " + (available > 0 ? "is-available" : "is-unavailable")}>
    <strong><span className="catalogue-pips" aria-hidden="true">{Array.from({ length: Math.min(total ?? available, 8) }, (_, index) => <i key={index} className={index < available ? "is-filled" : ""} />)}</span>{available > 0 ? "Available" : total === null ? "Availability not recorded" : "Unavailable"}</strong>
    <span>{total === null ? available > 0 ? available + " copies available" : "Check with the library" : available + " of " + total + " copies available"}</span>
  </div>;
}

export default function CatalogueResult({ book, schema, expanded, onToggle }: { book: Book; schema: PublicCatalogSchemaField[]; expanded: boolean; onToggle: () => void }) {
  const reference = book.material_type === "thesis";
  const action = reference ? "View related theses" : "View similar books";
  const metadata = [book.isbn && "ISBN " + book.isbn, book.publisher, book.publication_year, book.edition && String(book.edition) + (/\bed\.?$/i.test(String(book.edition)) ? "" : " ed.")].filter(Boolean).map(String).join(" · ");
  const fields = schema.filter(field => field.public && !CORE_KEYS.has(field.key)).sort((a, b) => a.order - b.order).flatMap(field => {
    const value = book[field.key];
    return value == null || value === "" ? [] : [{ label: field.label, value: Array.isArray(value) ? value.join(", ") : String(value) }];
  });
  return <article className={"catalogue-record " + (expanded ? "is-expanded" : "")}>
    <BookCover book={book} />
    <div className="catalogue-record-copy">
      <h2><button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={expanded ? "recommendations-" + book.id : undefined}>{book.title}</button></h2>
      <div className="catalogue-author">{book.author || "Unknown author"}{book.category && book.category !== "Uncategorized" && <> · <b>{book.category}</b></>}</div>
      {metadata && <p className="catalogue-metadata">{metadata}</p>}
      {fields.length > 0 && <dl className="catalogue-extra-fields">{fields.map(field => <div key={field.label}><dt>{field.label}:</dt><dd>{field.value}</dd></div>)}</dl>}
      <div className="catalogue-record-actions">
      <button type="button" className="catalogue-similar-action" aria-label={action + " for " + book.title} aria-expanded={expanded} aria-controls={expanded ? "recommendations-" + book.id : undefined} onClick={onToggle}>{action}<ChevronDown aria-hidden="true" /></button>
      </div>
    </div>
    <div className="catalogue-record-side">
      <Availability book={book} />
      {!reference && Number(book.canReserve) === 1 && <Link className="catalogue-primary catalogue-reserve-action" to={`/services/borrowing?bookId=${book.id}`} aria-label={`Reserve ${book.title}`}>{Number(book.available) > 0 ? "Reserve" : "Reserve when returned"}</Link>}
    </div>
    {expanded && <div className="catalogue-similar" id={"recommendations-" + book.id}><RecommendationStrip seedBookId={book.id} materialType={book.material_type || "book"} title={(reference ? "Related theses for " : "Similar books to ") + book.title} /></div>}
  </article>;
}
