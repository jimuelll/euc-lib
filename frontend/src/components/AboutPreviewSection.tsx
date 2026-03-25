import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const AboutPreviewSection = () => {
  return (
    <section className="relative bg-background py-20 sm:py-28 border-t border-border overflow-hidden">

      {/* Faint maroon wash — tints without dominating */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(105deg, hsl(var(--primary) / 0.04) 0%, transparent 60%)",
        }}
      />

      {/* Gold left spine — carries the language without the maroon field */}
      <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />

      <div className="container relative z-10 px-4 sm:px-6">
        <div className="max-w-2xl">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 mb-7"
          >
            <div className="h-px w-6 bg-warning" />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              About the Library
            </p>
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Committed to Academic
            <br />
            <span className="text-primary">Excellence</span>
          </motion.h2>

          {/* Body */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-lg"
          >
            Our college library fosters scholarly growth through comprehensive resources,
            modern facilities, and digital services. With a growing collection and access
            to leading research databases, we support every student and faculty member
            in their pursuit of knowledge.
          </motion.p>

          {/* Divider rule */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            className="mt-8 h-px w-16 bg-border origin-left"
          />

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="mt-8"
          >
            <Link
              to="/about"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Learn More
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default AboutPreviewSection;