import SectionLabel from "./ui/SectionLabel";
import SectionHeading from "./ui/SectionHeading";

interface PoliciesFacilitiesProps {
  policies: string[];
  facilities: string[];
}

const NumberedList = ({
  items,
  accentClass,
}: {
  items: string[];
  accentClass: string;
}) => (
  <div className="space-y-0 border-t border-border mt-6">
    {items.map((item, i) => (
      <div key={i} className="flex items-start gap-4 border-b border-border py-3.5">
        <span
          className={`text-[10px] font-bold tracking-[0.15em] mt-0.5 shrink-0 ${accentClass}`}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {String(i + 1).padStart(2, "0")}
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
      </div>
    ))}
  </div>
);

const PoliciesFacilities = ({ policies, facilities }: PoliciesFacilitiesProps) => (
  <div className="border-b border-border">
    <div className="container px-4 sm:px-6">
      <div className="grid md:grid-cols-2 border-l border-t border-border">
        <div className="border-r border-b border-border bg-background p-8 md:p-10">
          <SectionLabel>Rules & Policies</SectionLabel>
          <SectionHeading>Borrowing Guidelines</SectionHeading>
          <NumberedList items={policies} accentClass="text-primary/50" />
        </div>
        <div className="border-r border-b border-border bg-background p-8 md:p-10">
          <SectionLabel>Facilities & Resources</SectionLabel>
          <SectionHeading>What We Offer</SectionHeading>
          <NumberedList items={facilities} accentClass="text-warning/60" />
        </div>
      </div>
    </div>
  </div>
);

export default PoliciesFacilities;