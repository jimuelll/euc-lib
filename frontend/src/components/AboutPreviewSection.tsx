import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const AboutPreviewSection = () => (
  <section className="border-b border-border bg-background py-16 sm:py-20">
    <div className="container px-5 sm:px-8 lg:px-12 xl:px-16">
      <div className="grid overflow-hidden border border-border lg:grid-cols-[.82fr_1.18fr]">
        <div className="relative min-h-[280px] overflow-hidden border-b border-border lg:min-h-[430px] lg:border-b-0 lg:border-r">
          <img src="/hero.jpg" alt="Books and study tables at the library" className="absolute inset-0 h-full w-full object-cover object-[35%_center]" loading="lazy" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(50_0_0_/_0.74),transparent_65%)]" />
          <div className="absolute bottom-0 left-0 border-l-[3px] border-warning px-6 py-6 text-white sm:px-8">
            <p className="homepage-kicker text-warning">MSEUF-CI Library</p>
            <p className="mt-2 max-w-[12rem] text-xl font-bold leading-tight tracking-[-.04em]">A place for bigger ideas.</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .45 }} className="flex flex-col px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <p className="homepage-kicker flex items-center gap-3 text-primary"><span className="h-px w-8 bg-warning" />About the Library</p>
          <h2 className="mt-5 max-w-xl text-4xl font-bold leading-[.92] tracking-[-.06em] text-foreground sm:text-5xl">Academic support, made more accessible.</h2>
          <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            The Enverga-Candelaria Library supports scholarly growth through a rich and diverse collection, modern resources, and responsive services for every student and faculty member.
          </p>
          <div className="mt-auto pt-9">
            <Link to="/about" className="inline-flex items-center gap-3 border border-primary px-5 py-3 text-[10px] font-bold tracking-[.18em] uppercase text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default AboutPreviewSection;
