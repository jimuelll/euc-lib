import { Link } from "react-router-dom";
import { BookOpen, CalendarCheck, GraduationCap, Library, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const quickLinks = [
  {
    title: "Book Catalogue",
    description: "Browse and search the full library collection.",
    to: "/catalogue",
    icon: BookOpen,
    index: "01",
  },
  {
    title: "Digital Reservation",
    description: "Reserve books online. Login required.",
    to: "/login",
    icon: CalendarCheck,
    index: "02",
  },
  {
    title: "Academic Subscriptions",
    description: "Access digital resources and online databases.",
    to: "/services",
    icon: GraduationCap,
    index: "03",
  },
  {
    title: "Library Services",
    description: "Borrowing, returning, and more.",
    to: "/services",
    icon: Library,
    index: "04",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const QuickAccessSection = () => {
  return (
    /* bg-background gives it its own floor, border-t draws the line between hero and cards */
    <section className="bg-background border-t border-border py-10">
      <div className="container">

        {/* Section label — orients the reader, marks the transition */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="h-px w-6 bg-warning" />
          <p
            className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Quick Access
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-l border-t border-border"
        >
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <motion.div key={link.title} variants={cardVariants}>
                <Link
                  to={link.to}
                  className="group relative flex h-full flex-col border-r border-b border-border bg-card p-6 transition-colors duration-200 hover:bg-primary hover:border-primary"
                >
                  {/* Index number */}
                  <span
                    className="mb-6 block text-[10px] font-bold tracking-[0.25em] text-muted-foreground/50 group-hover:text-primary-foreground/40 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {link.index}
                  </span>

                  {/* Icon */}
                  <div className="mb-4">
                    <Icon className="h-5 w-5 text-primary group-hover:text-warning transition-colors duration-200" />
                  </div>

                  {/* Title */}
                  <h3
                    className="text-[13px] font-bold tracking-[0.06em] uppercase text-foreground group-hover:text-primary-foreground transition-colors duration-200 leading-snug"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {link.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground group-hover:text-primary-foreground/60 transition-colors duration-200 flex-1">
                    {link.description}
                  </p>

                  {/* Arrow */}
                  <div className="mt-5 flex items-center gap-1.5">
                    <div className="h-px w-4 bg-border group-hover:bg-warning/60 transition-colors duration-200" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-warning transition-colors duration-200" />
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