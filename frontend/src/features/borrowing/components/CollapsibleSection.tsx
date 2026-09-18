import { useState, type ElementType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon: ElementType;
  count: number;
  countVariant?: "default" | "destructive";
  children: ReactNode;
}

const CollapsibleSection = ({
  title,
  icon: Icon,
  count,
  countVariant = "default",
  children,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden border border-border bg-card">

      {/* Header — trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between bg-card px-5 py-3.5 text-left transition-colors duration-200 hover:bg-muted/30 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3">
          {/* Gold left rule when open */}
          <div className={`h-4 w-[2px] shrink-0 transition-colors ${open ? "bg-warning" : "bg-border"}`} />

          <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />

          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </span>

          {/* Count badge — institutional pill */}
          <span
            className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold border ${
              countVariant === "destructive"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-muted text-muted-foreground"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {count}
          </span>
        </div>

        {/* Chevron — rotates on open */}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Separator line */}
      {open && <div className="h-px bg-border" />}

      {/* Content */}
      {open && (
        <div className="space-y-0 divide-y divide-border/60 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
