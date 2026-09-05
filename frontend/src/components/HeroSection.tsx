import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/context/AuthContext";
import { getSiteContent, type SiteContent } from "@/services/site-content.service";

const HeroSection = () => {
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState("");
  const [content, setContent] = useState<SiteContent | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isLoggedIn, loading } = useAuth();
  const isDark = theme === "dark";

  useEffect(() => { getSiteContent().then(setContent).catch(() => undefined); }, []);

  const submitSearch = () => {
    if (query.trim()) navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-warning/70 bg-[#180908] text-white">
      <div className="absolute inset-0">
        <img
          src={content?.hero_image_url || "/hero.jpg"}
          alt="Bookshelves inside the Enverga-Candelaria Library"
          className="h-full w-full object-cover object-[63%_center]"
        />
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(90deg, rgb(128 0 0 / .97) 0%, rgb(128 0 0 / .88) 42%, rgb(31 7 7 / .32) 76%, rgb(18 5 5 / .72) 100%)"
              : "linear-gradient(90deg, rgb(128 0 0 / .94) 0%, rgb(105 5 5 / .84) 42%, rgb(30 6 5 / .27) 76%, rgb(25 5 5 / .68) 100%)",
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_49.9%,rgb(255_255_255_/_0.09)_50%,transparent_50.1%)]" />

      <div className="container relative z-10 flex min-h-[calc(100svh-59px)] flex-col justify-end px-5 pb-10 pt-16 sm:px-8 sm:pb-14 lg:min-h-[clamp(42rem,calc(100svh-59px),50rem)] lg:px-12 lg:pb-12 lg:pt-20 xl:px-16">
        <div className="relative max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}
            className="homepage-kicker flex items-center gap-3 text-white/75"
          >
            <span className="h-px w-8 bg-warning" />
            {content?.hero_kicker || "Manuel S. Enverga University Foundation — Candelaria Inc."}
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: .14 }} transition={{ duration: .8, delay: .08 }} className="pointer-events-none absolute -left-2 top-3 select-none text-[clamp(5.5rem,16vw,14rem)] font-bold leading-none tracking-[-.07em] text-white sm:-left-5 lg:-left-10">
            LIBRARY
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .58, delay: .1 }}
            className="relative mt-16 max-w-2xl text-[clamp(2.9rem,5.7vw,5.6rem)] font-bold leading-[.91] tracking-[-.065em]"
          >
            {content?.hero_title || "Enverga-Candelaria"}
            <span className="mt-1 block tracking-[-.035em] text-warning">{content?.hero_highlight || "Library"}</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .19 }} className="relative mt-6 max-w-lg text-base leading-7 text-white/82 sm:text-lg">
            {content?.hero_description || "Discover, reserve, and access the university’s academic collection."}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .48, delay: .27 }} className="relative mt-8 max-w-xl">
            <div className={`flex h-12 items-center border px-4 transition-colors ${searchActive ? "border-warning bg-black/30" : "border-white/45 bg-black/20 hover:border-white/70"}`} onClick={() => { setSearchActive(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
              <Search className="mr-3 h-4 w-4 shrink-0 text-white/70" />
              {searchActive ? (
                <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); if (event.key === "Escape") setSearchActive(false); }} onBlur={() => { if (!query) setSearchActive(false); }} placeholder="Search the catalogue" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/55" />
              ) : <span className="text-sm text-white/65">Search the catalogue</span>}
              <button type="button" aria-label="Search catalogue" onClick={submitSearch} className="ml-auto p-1 text-warning transition-transform hover:translate-x-0.5"><ArrowRight className="h-5 w-5" /></button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .48, delay: .35 }} className="relative mt-4 flex flex-col gap-3 sm:flex-row">
            <Link to="/catalogue" className="inline-flex h-12 items-center justify-center gap-3 bg-warning px-6 text-[11px] font-bold tracking-[.16em] text-[#1a0b08] uppercase transition-colors hover:bg-[#f8c84e]">
              Browse Catalogue <ArrowRight className="h-4 w-4" />
            </Link>
            {!loading && <Link to={isLoggedIn ? "/my-library" : "/login"} className="inline-flex h-12 items-center justify-center gap-3 border border-warning/80 px-6 text-[11px] font-bold tracking-[.16em] uppercase text-white transition-colors hover:bg-white/10">
              {isLoggedIn ? "Go to My Library" : "Login for Reservation"}
            </Link>}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6, delay: .45 }} className="mt-9 grid w-full max-w-xl grid-cols-3 border-t border-white/25 pt-5 lg:mt-10">
          {(content?.hero_stats || [{ value: "12,000+", label: "Volumes" }, { value: "400+", label: "Journals" }, { value: "24/7", label: "Digital Access" }]).map((stat, index) => (
            <div key={stat.label} className={`px-3 first:pl-0 ${index ? "border-l border-white/25" : ""}`}>
              <p className="text-2xl font-bold tracking-[-.05em] sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-[9px] font-bold tracking-[.19em] uppercase text-white/62">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
