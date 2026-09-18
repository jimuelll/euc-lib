import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
}

const SectionLabel = ({ children }: SectionLabelProps) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="h-px w-6 bg-warning shrink-0" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  </div>
);

export default SectionLabel;