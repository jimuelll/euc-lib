import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const staffMembers = [
  { name: "Dr. Elena Santos",  role: "Head Librarian"           },
  { name: "Mr. James Reyes",   role: "Systems Librarian"        },
  { name: "Ms. Ana Cruz",      role: "Cataloguing Specialist"   },
  { name: "Mr. Carlos Rivera", role: "Circulation Desk Officer" },
];

const librarySpaces = [
  {
    name: "Main Reading Hall",
    description: "A quiet, spacious area with 200+ seats for focused reading and study.",
    image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&h=250&fit=crop",
  },
  {
    name: "Computer Lab",
    description: "Equipped with internet-connected workstations for research and digital access.",
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=250&fit=crop",
  },
  {
    name: "Group Study Rooms",
    description: "Reservable rooms for collaborative projects and group discussions.",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=250&fit=crop",
  },
  {
    name: "Periodicals Section",
    description: "Current newspapers, magazines, and journal archives.",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=250&fit=crop",
  },
];

const policies = [
  "Borrowing period: 14 days for students, 30 days for faculty",
  "Maximum of 5 books at a time",
  "Late fees apply after the due date",
  "Library cards must be presented for all transactions",
  "Quiet zones must be respected at all times",
];

const facilities = [
  "3 reading halls with 200+ seating capacity",
  "Dedicated computer lab with internet access",
  "Group study rooms (reservable)",
  "Print and photocopy services",
  "Accessibility-friendly facilities",
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
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

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-bold tracking-tight text-foreground mb-4" style={{ fontFamily: "var(--font-heading)" }}>
    {children}
  </h2>
);

const About = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* ── Page header band ── */}
    <div className="bg-primary relative overflow-hidden">
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div className="relative z-10 h-[3px] w-full bg-warning" />
      <div
        className="absolute inset-0 z-10 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
        }}
      />
      <div className="absolute inset-y-0 left-0 z-10 w-[3px] bg-warning" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-black/30" />

      <div className="container relative z-20 px-4 sm:px-6 py-14 md:py-16">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px w-6 bg-warning shrink-0" />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Enverga-Candelaria Library
          </span>
        </div>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-primary-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          About the Library
        </h1>
        <p className="mt-3 text-sm text-primary-foreground/50 max-w-lg leading-relaxed">
          Our history, mission, staff, and facilities — everything you need to know about the EUC Library.
        </p>
      </div>
    </div>

    <main className="bg-background">

      {/* ── Mission & History ── */}
      <div className="border-b border-border">
        <div className="container px-4 sm:px-6">
          <div className="grid md:grid-cols-2 border-l border-t border-border">
            <div className="border-r border-b border-border bg-background p-8 md:p-10">
              <SectionLabel>Mission & Vision</SectionLabel>
              <SectionHeading>Empowering Academic Growth</SectionHeading>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our mission is to empower every student and faculty member with seamless access
                to knowledge resources. We envision a fully digitalized, efficient library
                ecosystem that promotes academic research, lifelong learning, and intellectual growth.
              </p>
            </div>
            <div className="border-r border-b border-border bg-background p-8 md:p-10">
              <SectionLabel>Library History</SectionLabel>
              <SectionHeading>Est. 1975</SectionHeading>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Established in 1975, our library has grown from a small reading room with 500 volumes
                to a modern facility housing over 50,000 titles, digital subscriptions, and
                state-of-the-art study spaces.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rules & Facilities ── */}
      <div className="border-b border-border">
        <div className="container px-4 sm:px-6">
          <div className="grid md:grid-cols-2 border-l border-t border-border">
            <div className="border-r border-b border-border bg-background p-8 md:p-10">
              <SectionLabel>Rules & Policies</SectionLabel>
              <SectionHeading>Borrowing Guidelines</SectionHeading>
              <div className="space-y-0 border-t border-border mt-6">
                {policies.map((policy, i) => (
                  <div key={i} className="flex items-start gap-4 border-b border-border py-3.5">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-primary/50 mt-0.5 shrink-0" style={{ fontFamily: "var(--font-heading)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{policy}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-r border-b border-border bg-background p-8 md:p-10">
              <SectionLabel>Facilities & Resources</SectionLabel>
              <SectionHeading>What We Offer</SectionHeading>
              <div className="space-y-0 border-t border-border mt-6">
                {facilities.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 border-b border-border py-3.5">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-warning/60 mt-0.5 shrink-0" style={{ fontFamily: "var(--font-heading)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Library Staff ── */}
      <div className="border-b border-border bg-background">
        <div className="container px-4 sm:px-6 py-10 md:py-14">
          <SectionLabel>Library Staff</SectionLabel>
          <SectionHeading>Meet the Team</SectionHeading>
          <p className="text-xs text-muted-foreground/60 mb-8 -mt-2 italic">Staff directory configurable by admin.</p>
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 border-l border-t border-border">
            {staffMembers.map((staff) => {
              const initials = staff.name.split(" ").filter((_, i, a) => i === 0 || i === a.length - 1).map(n => n[0]).join("");
              return (
                <div key={staff.name} className="border-r border-b border-border bg-background p-6 flex flex-col gap-4">
                  <div className="flex h-10 w-10 items-center justify-center bg-primary border border-primary/20">
                    <span className="text-[11px] font-bold tracking-widest text-primary-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {initials}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{staff.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-1" style={{ fontFamily: "var(--font-heading)" }}>{staff.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Library Spaces ── */}
      <div className="border-b border-border bg-background">
        <div className="container px-4 sm:px-6 py-10 md:py-14">
          <SectionLabel>Library Spaces</SectionLabel>
          <SectionHeading>Our Facilities</SectionHeading>
          <p className="text-xs text-muted-foreground/60 mb-8 -mt-2 italic">Photos and descriptions configurable by admin.</p>
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 border-l border-t border-border">
            {librarySpaces.map((space) => (
              <div key={space.name} className="border-r border-b border-border bg-background flex flex-col overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  <img src={space.image} alt={space.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-primary/20" />
                </div>
                <div className="p-5 flex flex-col gap-1.5 flex-1">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{space.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{space.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </main>

    <Footer />
  </div>
);

export default About;