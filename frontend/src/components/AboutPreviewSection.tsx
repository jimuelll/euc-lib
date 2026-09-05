import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const AboutPreviewSection = () => (
  <section className="grid min-w-0 overflow-hidden bg-card lg:grid-cols-[38%_minmax(0,1fr)] lg:border-r lg:border-border">
    <div className="relative aspect-[4/3] overflow-hidden border-b border-border lg:aspect-auto lg:min-h-full lg:border-b-0 lg:border-r">
      <img src="/hero.jpg" alt="Bookshelves in the library" className="absolute inset-0 h-full w-full object-cover object-[39%_center]" loading="lazy" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(41_5_4_/_0.68),transparent_72%)]" />
      <p className="absolute bottom-5 left-5 max-w-[8rem] text-[10px] font-bold uppercase leading-5 tracking-[.14em] text-warning">More than books. A brighter tomorrow.</p>
    </div>
    <div className="flex min-w-0 flex-col px-5 py-6 sm:px-7 sm:py-7">
      <span className="mb-3 block h-px w-7 bg-warning" />
      <h2 className="text-2xl font-bold leading-none tracking-[-.045em] text-foreground">About the Library</h2>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        The Enverga-Candelaria Library supports the academic and research mission of the university through a rich and diverse collection, modern resources, and responsive services.
      </p>
      <Link to="/about" className="mt-6 inline-flex min-h-11 w-fit items-center gap-3 border border-primary px-4 text-[10px] font-bold uppercase tracking-[.16em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
        Learn More <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  </section>
);

export default AboutPreviewSection;
