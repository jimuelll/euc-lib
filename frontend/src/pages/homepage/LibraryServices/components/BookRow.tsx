import type { ReactNode, ElementType } from "react";

interface BookRowProps {
  icon: ElementType;
  title: string;
  author: string;
  meta?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}

const BookRow = ({ icon: Icon, title, author, meta, badge, action }: BookRowProps) => (
  <div className="flex items-center gap-0 border border-border bg-card overflow-hidden group hover:border-primary/40 transition-colors">

    {/* Gold left accent bar — structural, not decorative */}
    <div className="w-[3px] self-stretch bg-border group-hover:bg-warning transition-colors shrink-0" />

    {/* Icon medallion */}
    <div className="hidden sm:flex h-full items-center justify-center px-4 py-4 bg-muted/40 border-r border-border shrink-0">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
    </div>

    {/* Title + author */}
    <div className="flex-1 min-w-0 px-4 py-3.5">
      <p
        className="text-[13px] font-bold text-foreground truncate leading-tight"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
      <p
        className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 truncate"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {author}
      </p>
    </div>

    {/* Meta — right-aligned, hidden on small screens */}
    {meta && (
      <div className="hidden sm:block px-4 py-3.5 text-right shrink-0 border-l border-border/60">
        {meta}
      </div>
    )}

    {/* Badge */}
    {badge && (
      <div className="px-3 py-3.5 shrink-0 border-l border-border/60">
        {badge}
      </div>
    )}

    {/* Action */}
    {action && (
      <div className="px-4 py-3.5 shrink-0 border-l border-border/60">
        {action}
      </div>
    )}
  </div>
);

export default BookRow;