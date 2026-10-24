import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { copyCount } from "./catalogue-copy-count";

export type CatalogueBookPresentation = {
  title: string; author?: string | null; image_url?: string | null;
  material_type?: string; available?: number; registered_copies?: number | null;
};

export function CatalogueCover({ book, children }: { book: CatalogueBookPresentation; children?: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImage = book.image_url && book.material_type !== "thesis" && failedUrl !== book.image_url;
  return <div className="catalogue-cover">
    <div className="catalogue-cover-art">
      {hasImage ? <img src={book.image_url!} alt={`Cover of ${book.title}`} width={200} height={300} onError={() => setFailedUrl(book.image_url!)} loading="lazy" /> :
        <div className="catalogue-cover-fallback" role="img" aria-label={`Cover not available: ${book.title}`}>
          <small>EUC LIBRARY</small><span aria-hidden="true">{Array.from(book.title.trim())[0]?.toLocaleUpperCase() || "E"}</span><em>{book.author || "Unknown author"}</em>
        </div>}
    </div>
    {children}
  </div>;
}

export function CatalogueAvailability({ book }: { book: CatalogueBookPresentation }) {
  const reference = book.material_type === "thesis";
  const available = !reference && Number(book.available) > 0;
  return <div className={`catalogue-status ${available ? "is-available" : "is-unavailable"}`}>
    <strong>{available ? "Available" : "Unavailable"}</strong>
    <span title={reference ? "Reference only · In-library use" : undefined} aria-label={reference ? "Reference only. In-library use" : undefined}>{reference ? "Reference only" : copyCount(book.available ?? 0, book.registered_copies)}</span>
  </div>;
}


export function CatalogueCompactCard({ book, coverAction, coverBadge, footerAction, titleHref, reason, expanded = false }: {
  book: CatalogueBookPresentation & { category?: string | null };
  coverAction?: ReactNode; coverBadge?: ReactNode; footerAction?: ReactNode; titleHref?: string; reason?: string; expanded?: boolean;
}) {
  return <article className={`catalogue-record catalogue-compact-card ${expanded ? "is-expanded" : ""}`}>
    <CatalogueCover book={book}>{coverBadge}{coverAction}</CatalogueCover>
    <div className="catalogue-record-copy">
      <h2 title={book.title}>{titleHref ? <Link to={titleHref}>{book.title}</Link> : book.title}</h2>
      <div className="catalogue-author" title={[book.author || "Unknown author", book.category].filter(Boolean).join(" · ")}>{book.author || "Unknown author"}{book.category && book.category !== "Uncategorized" && <> · <b>{book.category}</b></>}</div>
      {reason && <p className="catalogue-compact-reason" title={reason}>{reason}</p>}
    </div>
    <div className="catalogue-record-side"><CatalogueAvailability book={book} />{footerAction}</div>
  </article>;
}
