import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import PostModal from "@/components/PostModal";
import type { BulletinPost } from "@/pages/public/Bulletin";

const latestPosts: BulletinPost[] = [
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
    ],
  },
  {
    id: 2,
    title: "New Arrivals: Computer Science Collection",
    date: "March 8, 2026",
    excerpt: "50+ new titles added to the CS section including AI, systems design, and cybersecurity.",
    content: "We're excited to announce 50+ new titles in the Computer Science collection. Topics include artificial intelligence, distributed systems design, cybersecurity fundamentals, and modern web development.",
    likes: 42,
    comments: [],
  },
  {
    id: 3,
    title: "Library Photo Contest Winners",
    date: "March 1, 2026",
    excerpt: "Congratulations to the winners of our annual library photo contest!",
    content: "We received over 100 entries for this year's photo contest. The top three winners will have their photographs displayed in the library lobby for the entire month of March.",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop",
    likes: 56,
    comments: [
      { author: "Lisa K.", text: "Beautiful photos!", date: "March 2, 2026" },
    ],
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, rotateX: 8 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const AnnouncementsSection = () => {
  const [selected, setSelected] = useState<BulletinPost | null>(null);

  return (
    <section className="py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="font-heading text-2xl font-semibold text-foreground">
              Latest Posts
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Stay informed about library news, policies, and updates.
            </p>
          </div>
          <Link to="/bulletin">
            <Button variant="outline" size="sm" className="group">
              View All Posts
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {latestPosts.map((post) => (
            <motion.button
              key={post.id}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(post)}
              className="group flex flex-col rounded-lg border bg-card text-left transition-colors duration-150 hover:border-primary/30 hover:shadow-lg overflow-hidden"
            >
              <div className="relative h-36 w-full bg-muted overflow-hidden">
                {post.image ? (
                  <motion.img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs text-muted-foreground">{post.date}</p>
                <h3 className="mt-1.5 font-heading text-base font-medium text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-2">
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
              </div>
            </motion.button>
          ))}
        </motion.div>

        <PostModal post={selected} onClose={() => setSelected(null)} />
      </div>
    </section>
  );
};

export default AnnouncementsSection;
