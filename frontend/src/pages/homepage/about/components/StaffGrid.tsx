import type { AboutSettings } from "@/services/about.service";
import SectionLabel from "./ui/SectionLabel";
import SectionHeading from "./ui/SectionHeading";

interface StaffGridProps {
  staff: AboutSettings["staff"];
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map((n) => n[0])
    .join("");

const StaffGrid = ({ staff }: StaffGridProps) => (
  <div className="border-b border-border bg-background">
    <div className="container px-4 sm:px-6 py-10 md:py-14">
      <SectionLabel>Library Staff</SectionLabel>
      <SectionHeading>Meet the Team</SectionHeading>
      <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 border-l border-t border-border">
        {staff.map((member) => (
          <div
            key={member.name}
            className="border-r border-b border-border bg-background p-6 flex flex-col items-center gap-4 text-center"
          >
            {/* Avatar — photo if available, initials fallback */}
            {member.image_url ? (
              <img
                src={member.image_url}
                alt={member.name}
                className="h-24 w-24 object-cover border border-border"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center bg-primary border border-primary/20">
                <span
                  className="text-lg font-bold tracking-widest text-primary-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {getInitials(member.name)}
                </span>
              </div>
            )}

            <div>
              <p
                className="text-[13px] font-bold text-foreground tracking-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {member.name}
              </p>
              <p
                className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-1"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {member.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default StaffGrid;