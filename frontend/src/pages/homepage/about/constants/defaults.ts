import type { AboutSettings } from "@/services/about.service";

export const ABOUT_DEFAULTS: AboutSettings = {
  library_name: "Enverga-Candelaria Library",
  established: 2010,
  mission_title: "Empowering Academic Growth",
  mission_text:
    "Our mission is to empower every student and faculty member with seamless access to knowledge resources. We envision a fully digitalized, efficient library ecosystem that promotes academic research, lifelong learning, and intellectual growth.",
  history_title: "Est. 2010",
  history_text:
    "Established in 2010, our library has grown from a small reading room with 500 volumes to a modern facility housing over 50,000 titles, digital subscriptions, and state-of-the-art study spaces.",
  policies: [
    "Borrowing period: 14 days for students, 30 days for faculty",
    "Maximum of 5 books at a time",
    "Late fees apply after the due date",
    "Library cards must be presented for all transactions",
    "Quiet zones must be respected at all times",
  ],
  facilities: [
    "3 reading halls with 200+ seating capacity",
    "Dedicated computer lab with internet access",
    "Group study rooms (reservable)",
    "Print and photocopy services",
    "Accessibility-friendly facilities",
  ],
  staff: [
    { name: "Dr. Elena Santos",  role: "Head Librarian" },
    { name: "Mr. James Reyes",   role: "Systems Librarian" },
    { name: "Ms. Ana Cruz",      role: "Cataloguing Specialist" },
    { name: "Mr. Carlos Rivera", role: "Circulation Desk Officer" },
  ],
  spaces: [
    {
      name: "Main Reading Hall",
      description: "A quiet, spacious area with 200+ seats for focused reading and study.",
      image_url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&h=250&fit=crop",
    },
    {
      name: "Computer Lab",
      description: "Equipped with internet-connected workstations for research and digital access.",
      image_url: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=250&fit=crop",
    },
    {
      name: "Group Study Rooms",
      description: "Reservable rooms for collaborative projects and group discussions.",
      image_url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=250&fit=crop",
    },
    {
      name: "Periodicals Section",
      description: "Current newspapers, magazines, and journal archives.",
      image_url: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=250&fit=crop",
    },
  ],
};