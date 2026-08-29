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
  <div className="group flex flex-col overflow-hidden border border-border bg-card transition-colors duration-200 hover:border-primary/45 hover:bg-secondary/30 sm:flex-row sm:items-stretch">

    {/* Gold left accent bar — structural, not decorative */}
    <div className="h-[3px] w-full shrink-0 bg-border transition-colors group-hover:bg-warning sm:h-auto sm:w-[3px]" />

    {/* Icon medallion */}
    <div className="hidden shrink-0 items-center justify-center border-r border-border bg-muted/40 px-4 py-4 sm:flex">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
    </div>

    {/* Title + author */}
    <div className="min-w-0 flex-1 px-4 py-4">
      <p
        className="break-words text-[13px] font-bold leading-tight text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </p>
      <p
        className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {author}
      </p>
    </div>

    {/* Meta — right-aligned on larger screens, retained below details on mobile */}
    {meta && (
      <div className="border-t border-border/60 px-4 py-3 text-left sm:block sm:shrink-0 sm:border-l sm:border-t-0 sm:text-right">
        {meta}
      </div>
    )}

    {/* Badge */}
    {badge && (
      <div className="border-t border-border/60 px-4 py-3 sm:shrink-0 sm:border-l sm:border-t-0">
        {badge}
      </div>
    )}

    {/* Action */}
    {action && (
      <div className="border-t border-border/60 px-4 py-3 sm:shrink-0 sm:border-l sm:border-t-0">
        {action}
      </div>
    )}
  </div>
);

export default BookRow;
