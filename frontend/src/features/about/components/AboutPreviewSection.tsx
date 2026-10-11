import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight } from "@/components/ui/library-glyphs";
import { useSiteContent } from "@/features/site-content/useSiteContent";
import { getTodayHours } from "@/features/site-content/today-hours";

const AboutPreviewSection = () => {
  const { data: content } = useSiteContent();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="home-editorial-about min-w-0 bg-card">
      <div className="home-editorial-about-copy">
        <p className="home-editorial-kicker text-xs font-bold uppercase tracking-[.16em] text-warning">About us</p>
        <h2 className="text-2xl font-bold leading-none text-foreground">About the Library</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The Enverga-Candelaria Library supports the academic and research mission of the university through a rich and diverse collection, modern resources, and responsive services.
        </p>
        <Link to="/about" className="mt-4 inline-flex min-h-11 w-fit items-center gap-3 text-xs font-bold uppercase tracking-[.08em] text-primary hover:text-warning">
          Learn More <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="home-editorial-about-photo relative overflow-hidden">
        <img src="/hero.jpg" alt="Bookshelves in the library" className="absolute inset-0 h-full w-full object-cover object-[39%_center]" loading="lazy" />
        <div className="absolute inset-0 bg-black/50" />
        <p className="absolute bottom-4 left-4 right-4 text-xs font-bold uppercase leading-5 tracking-[.1em] text-white">More than books. A brighter tomorrow.</p>
      </div>
      <a href="#library-hours" className="home-editorial-about-hours block text-xs leading-5 text-muted-foreground hover:text-primary">
        {getTodayHours(content?.hours, now)}
        <ArrowRight className="ml-2 inline h-3 w-3" aria-hidden="true" />
      </a>
    </section>
  );
};
export default AboutPreviewSection;
