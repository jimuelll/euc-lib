import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const staffMembers = [
  { name: "Dr. Elena Santos", role: "Head Librarian", placeholder: true },
  { name: "Mr. James Reyes", role: "Systems Librarian", placeholder: true },
  { name: "Ms. Ana Cruz", role: "Cataloguing Specialist", placeholder: true },
  { name: "Mr. Carlos Rivera", role: "Circulation Desk Officer", placeholder: true },
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

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">About the Library</h1>

          <section className="mt-12 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Mission & Vision</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our mission is to empower every student and faculty member with seamless access to 
              knowledge resources. We envision a fully digitalized, efficient library ecosystem 
              that promotes academic research, lifelong learning, and intellectual growth.
            </p>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Library History</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Established in 1975, our library has grown from a small reading room with 500 volumes 
              to a modern facility housing over 50,000 titles, digital subscriptions, and 
              state-of-the-art study spaces.
            </p>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Rules & Policies</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Borrowing period: 14 days for students, 30 days for faculty</li>
              <li>• Maximum of 5 books at a time</li>
              <li>• Late fees apply after the due date</li>
              <li>• Library cards must be presented for all transactions</li>
              <li>• Quiet zones must be respected at all times</li>
            </ul>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Facilities & Resources</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 3 reading halls with 200+ seating capacity</li>
              <li>• Dedicated computer lab with internet access</li>
              <li>• Group study rooms (reservable)</li>
              <li>• Print and photocopy services</li>
              <li>• Accessibility-friendly facilities</li>
            </ul>
          </section>

          {/* Library Staff */}
          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Library Staff</h2>
            <p className="text-xs text-muted-foreground italic">Staff directory will be configurable by admin.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {staffMembers.map((staff) => (
                <div key={staff.name} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {staff.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{staff.name}</p>
                    <p className="text-xs text-muted-foreground">{staff.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Library Spaces */}
          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">Library Spaces</h2>
            <p className="text-xs text-muted-foreground italic">Photos and descriptions will be configurable by admin.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {librarySpaces.map((space) => (
                <div key={space.name} className="overflow-hidden rounded-lg border bg-card">
                  <img
                    src={space.image}
                    alt={space.name}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <h3 className="font-heading text-sm font-medium text-foreground">{space.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{space.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
