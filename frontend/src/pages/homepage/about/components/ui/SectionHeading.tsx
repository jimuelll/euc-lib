import type { ReactNode } from "react";

interface SectionHeadingProps {
  children: ReactNode;
}

const SectionHeading = ({ children }: SectionHeadingProps) => (
  <h2
    className="text-xl font-bold tracking-tight text-foreground mb-4"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </h2>
);

export default SectionHeading;