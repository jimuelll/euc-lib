import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getSiteContent, type SiteContent } from "@/features/site-content/site-content.service";

const HeroSection = () => {
  const [query, setQuery] = useState("");
  const [content, setContent] = useState<SiteContent | null>(null);
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    getSiteContent().then(setContent).catch(() => undefined);
  }, []);

  const submitSearch = () => {
    if (query.trim()) navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`);
  };

  const stats = content?.hero_stats || [
    { value: "12,000+", label: "Volumes" },
    { value: "400+", label: "Journals" },
    { value: "24/7", label: "Digital Access" },
  ];

  return (
    <section className="border-b border-border bg-card">
      <div className="relative isolate overflow-hidden bg-[#180908] text-white">
        <img
          src={content?.hero_image_url || "/hero.jpg"}
          alt="Bookshelves inside the Enverga-Candelaria Library"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(113,0,0,0.95)_0%,rgba(113,0,0,0.85)_39%,rgba(64,7,7,0.40)_72%,rgba(24,5,5,0.50)_100%)]" />

        <div className="container relative z-10 flex min-h-[35rem] items-center px-5 py-14 sm:px-8 sm:py-16 lg:min-h-[37rem] lg:px-12 xl:px-16">
          <div className="relative w-full max-w-[46rem]">
            <p className="relative flex max-w-xl items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
              <span className="h-px w-7 shrink-0 bg-[#f5c66b]" aria-hidden="true" />
              {content?.hero_kicker || "Manuel S. Enverga University Foundation — Candelaria Inc."}
            </p>

            <div className="pointer-events-none absolute -left-5 top-8 hidden select-none text-[clamp(5rem,12vw,10rem)] font-bold leading-none tracking-[-0.07em] text-white/10 lg:block" aria-hidden="true">
              LIBRARY
            </div>

            <h1 className="relative mt-6 max-w-[12ch] text-[clamp(3.25rem,6vw,5.25rem)] font-bold leading-[0.94] tracking-[-0.055em] sm:max-w-[10ch]">
              {content?.hero_title || "Enverga-Candelaria"}
              <span className="mt-1 block tracking-[-0.035em] text-[#f5c66b]">{content?.hero_highlight || "Library"}</span>
            </h1>

            <p className="relative mt-5 max-w-[35rem] text-base leading-7 text-white/90 sm:text-lg">
              {content?.hero_description || "Discover, reserve, and access the university’s academic collection."}
            </p>

            <form
              className="relative mt-8 flex h-12 max-w-[35rem] items-center overflow-hidden rounded-md border border-white/55 bg-black/20 text-white focus-within:ring-2 focus-within:ring-[#f5c66b] focus-within:ring-offset-2 focus-within:ring-offset-[#710000]"
              onSubmit={(event) => { event.preventDefault(); submitSearch(); }}
              role="search"
            >
              <Search className="ml-4 h-4 w-4 shrink-0 text-white/80" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
                placeholder="Search the catalogue"
                aria-label="Search the catalogue"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/80"
              />
              <button type="submit" aria-label="Search catalogue" className="flex h-full w-12 shrink-0 items-center justify-center text-[#f5c66b] transition-colors hover:bg-white/10">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="relative mt-4 flex flex-wrap gap-3">
              <Link to="/catalogue" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#f5c66b] px-5 text-sm font-bold text-[#25180f] transition-colors hover:bg-[#ffda94]">
                Browse Catalogue <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {!loading && (
                <Link to={isLoggedIn ? "/my-library" : "/login"} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#f5c66b]/80 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  {isLoggedIn ? "Go to My Library" : "Login for Reservation"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container grid grid-cols-3 divide-x divide-border px-5 py-5 sm:px-8 lg:px-12 xl:px-16">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 px-3 first:pl-0 sm:px-6 sm:first:pl-0">
            <p className="text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
