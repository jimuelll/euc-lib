import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PostModal from "@/components/PostModal";
import { Calendar, Heart, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulletinPost {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  image?: string;
  likes: number;
  comments: { author: string; text: string; date: string }[];
}

const samplePosts: BulletinPost[] = [
  {
    id: 1,
    title: "Holiday Notice: Spring Break",
    date: "March 15, 2026",
    excerpt: "The library will be closed from March 20–28 for spring break. Digital services remain available.",
    content: "The library will be closed from March 20–28 for spring break. All digital services, including e-books and online databases, will remain accessible. Physical book returns can be made at the drop-off box near the main entrance. Normal hours resume March 29.",
    image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=300&fit=crop",
    likes: 24,
    comments: [
      { author: "Juan D.", text: "Thanks for the heads up!", date: "March 15, 2026" },
      { author: "Maria S.", text: "Will the study rooms be open?", date: "March 16, 2026" },
    ],
  },
  {
    id: 2,
    title: "New Arrivals: Computer Science Collection",
    date: "March 8, 2026",
    excerpt: "50+ new titles added to the CS section including AI, systems design, and cybersecurity.",
    content: "We're excited to announce 50+ new titles in the Computer Science collection. Topics include artificial intelligence, distributed systems design, cybersecurity fundamentals, and modern web development. Visit the New Arrivals shelf on the 2nd floor or browse online.",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=300&fit=crop",
    likes: 42,
    comments: [
      { author: "Alex R.", text: "Finally some AI books!", date: "March 9, 2026" },
    ],
  },
  {
    id: 3,
    title: "System Maintenance: March 12",
    date: "March 5, 2026",
    excerpt: "Brief system downtime scheduled for catalogue and reservation services.",
    content: "Scheduled maintenance will take place on March 12 from 2:00 AM to 5:00 AM. During this time, the online catalogue and reservation system will be temporarily unavailable. We apologize for any inconvenience.",
    likes: 8,
    comments: [],
  },
  {
    id: 4,
    title: "Library Photo Contest Winners",
    date: "March 1, 2026",
    excerpt: "Congratulations to the winners of our annual library photo contest!",
    content: "We received over 100 entries for this year's photo contest. The top three winners will have their photographs displayed in the library lobby for the entire month of March. Thank you to everyone who participated!",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop",
    likes: 56,
    comments: [
      { author: "Lisa K.", text: "Beautiful photos!", date: "March 2, 2026" },
      { author: "Tom W.", text: "Congrats to all winners!", date: "March 2, 2026" },
    ],
  },
  {
    id: 5,
    title: "Extended Hours During Finals Week",
    date: "February 25, 2026",
    excerpt: "The library will extend operating hours during finals week to support student study needs.",
    content: "During finals week (March 30 – April 4), the library will be open from 6:00 AM to 12:00 AM (midnight) Monday through Friday, and 8:00 AM to 10:00 PM on Saturday and Sunday. Additional study spaces will be available on the 3rd floor.",
    likes: 89,
    comments: [
      { author: "Sarah M.", text: "This is so helpful!", date: "February 26, 2026" },
    ],
  },
  {
    id: 6,
    title: "New Reading Nook on 2nd Floor",
    date: "February 20, 2026",
    excerpt: "A cozy new reading area has been set up on the 2nd floor with comfortable seating.",
    content: "We've added a new reading nook on the 2nd floor featuring comfortable armchairs, warm lighting, and a curated selection of fiction and non-fiction titles. Perfect for leisurely reading between classes.",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&h=300&fit=crop",
    likes: 34,
    comments: [],
  },
  {
    id: 7,
    title: "Welcome Back: Spring Semester 2026",
    date: "January 15, 2026",
    excerpt: "Welcome back students! Here's what's new at the library this semester.",
    content: "Welcome back to a new semester! We've made several improvements over the break including updated computers in the lab, new database subscriptions, and refreshed study areas. Visit us to see what's new!",
    likes: 61,
    comments: [
      { author: "Chris P.", text: "Excited for the new databases!", date: "January 16, 2026" },
    ],
  },
];

const upcomingEvents = [
  {
    title: "Research Writing Workshop",
    date: "March 25, 2026",
    time: "2:00 PM – 4:00 PM",
  },
  {
    title: "Book Fair 2026",
    date: "April 5–7, 2026",
    time: "9:00 AM – 5:00 PM",
  },
  {
    title: "Digital Literacy Seminar",
    date: "April 15, 2026",
    time: "10:00 AM – 12:00 PM",
  },
  {
    title: "Author Meet & Greet",
    date: "April 22, 2026",
    time: "3:00 PM – 5:00 PM",
  },
];

const POSTS_PER_PAGE = 4;

const Bulletin = () => {
  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(samplePosts.length / POSTS_PER_PAGE);
  const paginatedPosts = samplePosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Bulletin Board</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Library posts, announcements, and upcoming events.
          </p>

          <div className="mt-10 flex flex-col gap-8 lg:flex-row">
            {/* Posts - Main Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-6 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs text-warning">
                  ⚠️ Please comment responsibly. All interactions are subject to school rules and policies. Violations may result in disciplinary action.
                </p>
              </div>

              <div className="space-y-4">
                {paginatedPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="w-full rounded-lg border bg-card p-5 text-left transition-all duration-150 hover:border-primary/30 hover:shadow-sm"
                  >
                    {post.image && (
                      <img
                        src={post.image}
                        alt={post.title}
                        className="mb-4 h-40 w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">{post.date}</p>
                    <h3 className="mt-1.5 font-heading text-base font-medium text-foreground">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" /> {post.comments.length}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <Button
                      key={i + 1}
                      variant={currentPage === i + 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(i + 1)}
                      className="w-9"
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Events Sidebar - Desktop */}
            <aside className="w-full lg:w-80 lg:shrink-0">
              <div className="rounded-lg border bg-card p-5 lg:sticky lg:top-20">
                <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Events
                </h2>
                <div className="mt-4 space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event.title} className="border-l-2 border-primary/30 pl-3">
                      <h3 className="font-heading text-sm font-medium text-foreground">
                        {event.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.date}</p>
                      <p className="text-xs text-muted-foreground">{event.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      <Footer />
    </div>
  );
};

export default Bulletin;
