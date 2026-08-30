import type { ElementType } from "react";

type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: ElementType<{ className?: string }>;
};

interface SegmentedNavigationProps<T extends string> {
  ariaLabel: string;
  value: T;
  segments: readonly Segment<T>[];
  onChange: (value: T) => void;
}

export function SegmentedNavigation<T extends string>({
  ariaLabel,
  value,
  segments,
  onChange,
}: SegmentedNavigationProps<T>) {
  return (
    <div className="flex overflow-hidden border border-border" role="tablist" aria-label={ariaLabel}>
      {segments.map(({ value: segmentValue, label, icon: Icon }) => {
        const active = value === segmentValue;

        return (
          <button
            key={segmentValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(segmentValue)}
            className={`flex h-11 flex-1 items-center justify-center gap-2 border-r border-border text-sm font-semibold transition-colors last:border-r-0 ${
              active
                ? "bg-warning text-warning-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
