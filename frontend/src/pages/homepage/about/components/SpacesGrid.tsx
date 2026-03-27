import type { AboutSettings } from "@/services/about.service";
import SectionLabel from "./ui/SectionLabel";
import SectionHeading from "./ui/SectionHeading";

interface SpacesGridProps {
  spaces: AboutSettings["spaces"];
}

const SpacesGrid = ({ spaces }: SpacesGridProps) => (
  <div className="border-b border-border bg-background">
    <div className="container px-4 sm:px-6 py-10 md:py-14">
      <SectionLabel>Library Spaces</SectionLabel>
      <SectionHeading>Our Facilities</SectionHeading>
      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 border-l border-t border-border">
        {spaces.map((space) => (
          <div
            key={space.name}
            className="border-r border-b border-border bg-background flex flex-col overflow-hidden"
          >
            <div className="relative h-40 overflow-hidden">
              <img
                src={space.image_url}
                alt={space.name}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-primary/20" />
            </div>
            <div className="p-5 flex flex-col gap-1.5 flex-1">
              <h3
                className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {space.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{space.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SpacesGrid;