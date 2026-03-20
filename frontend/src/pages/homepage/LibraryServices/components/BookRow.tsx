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
  <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
    <div className="hidden sm:flex h-12 w-9 shrink-0 items-center justify-center rounded bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-foreground truncate">{title}</p>
      <p className="text-xs text-muted-foreground">{author}</p>
    </div>
    {meta && <div className="hidden sm:block text-right shrink-0">{meta}</div>}
    {badge}
    {action}
  </div>
);

export default BookRow;