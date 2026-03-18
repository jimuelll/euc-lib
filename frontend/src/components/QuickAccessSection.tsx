import { Link } from "react-router-dom";
import { BookOpen, CalendarCheck, GraduationCap, Library } from "lucide-react";
import { motion } from "framer-motion";

const quickLinks = [
  {
    title: "Book Catalogue",
    description: "Browse and search the full library collection.",
    to: "/catalogue",
    icon: BookOpen,
  },
  {
    title: "Digital Reservation",
    description: "Reserve books online. Login required.",
    to: "/login",
    icon: CalendarCheck,
  },
  {
    title: "Academic Subscriptions",
    description: "Access digital resources and online databases.",
    to: "/services",
    icon: GraduationCap,
  },
  {
    title: "Library Services",
    description: "Borrowing, returning, and more.",
    to: "/services",
    icon: Library,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const QuickAccessSection = () => {
  return (
    <section className="py-12">
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <motion.div key={link.title} variants={cardVariants}>
                <Link
                  to={link.to}
                  className="group relative flex h-full items-start gap-3 rounded-lg border bg-card p-5 overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                >
                  {/* Hover glow */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  <motion.div
                    whileHover={{ rotate: [0, -15, 15, -5, 0], scale: 1.15 }}
                    transition={{ duration: 0.5 }}
                    className="relative"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  </motion.div>
                  <div className="relative">
                    <h3 className="font-heading text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {link.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default QuickAccessSection;
