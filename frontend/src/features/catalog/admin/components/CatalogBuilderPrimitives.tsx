import type { ReactNode } from "react";

export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${className ?? ""}`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </span>
);

export const PanelLabel = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border bg-muted/30">
    <div className="h-px w-4 bg-warning shrink-0" />
    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </p>
  </div>
);

export const FieldLabel = ({ children }: { children: ReactNode }) => (
  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5" style={{ fontFamily: "var(--font-heading)" }}>
    {children}
  </label>
);

