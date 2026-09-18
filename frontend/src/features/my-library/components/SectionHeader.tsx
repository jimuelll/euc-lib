import type { ElementType } from "react";

export const SectionHeader = ({
  icon: Icon,
  label,
  count,
}: {
  icon: ElementType;
  label: string;
  count?: number;
}) => (
  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
    <div className="flex items-center gap-3">
      <div className="h-4 w-[2px] bg-warning shrink-0" />
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </span>
    </div>
    {count !== undefined && (
      <span
        className="inline-flex items-center justify-center border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {count}
      </span>
    )}
  </div>
);
