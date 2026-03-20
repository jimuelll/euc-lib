import { useState, type ElementType, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
              countVariant === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {count}
          </span>
        </div>
        {open
          ? <ChevronUp  className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t pt-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;