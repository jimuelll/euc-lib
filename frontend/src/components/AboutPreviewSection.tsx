import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const AboutPreviewSection = () => (
  <section className="grid overflow-hidden border border-border bg-card lg:grid-cols-[10rem_minmax(0,1fr)]">
    <div className="relative min-h-[210px] overflow-hidden border-b border-border lg:min-h-full lg:border-b-0 lg:border-r">
      <img src="/hero.jpg" alt="Bookshelves in the library" className="absolute inset-0 h-full w-full object-cover object-[39%_center]" loading="lazy" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(41_5_4_/_0.68),transparent_72%)]" />
      <p className="absolute bottom-5 left-5 max-w-[8rem] text-[10px] font-bold uppercase leading-5 tracking-[.14em] text-warning">More than books. A brighter tomorrow.</p>
    </div>
    <div className="px-6 py-7 sm:px-8">
      <span className="mb-3 block h-px w-7 bg-warning" />
      <h2 className="text-2xl font-bold leading-none tracking-[-.045em] text-foreground">About the Library</h2>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
        The Enverga-Candelaria Library supports the academic and research mission of the university through a rich and diverse collection, modern resources, and responsive services.
      </p>
      <Link to="/about" className="mt-5 inline-flex items-center gap-3 border border-primary px-4 py-2.5 text-[10px] font-bold tracking-[.16em] uppercase text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
        Learn More <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  </section>
);

export default AboutPreviewSection;
