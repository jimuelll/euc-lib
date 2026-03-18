import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const AboutPreviewSection = () => {
  return (
    <section className="bg-card py-24">
      <div className="container max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-heading text-2xl font-semibold text-foreground"
        >
          About Our Library
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-sm text-muted-foreground leading-relaxed"
        >
          Our college library is committed to fostering academic excellence by providing
          comprehensive resources, modern facilities, and digital services. With a growing
          collection and access to leading research databases,
          we support the scholarly needs of every student and faculty member.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Link to="/about" className="mt-8 inline-block">
            <Button variant="outline">Learn More</Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutPreviewSection;
