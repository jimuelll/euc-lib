import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Search, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "@/hooks/use-theme"
import { useAuth } from "@/context/AuthContext"
import { getSiteContent, type SiteContent } from "@/services/site-content.service"

const HeroSection = () => {
  const [searchActive, setSearchActive] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { isLoggedIn, loading } = useAuth()
  const [content, setContent] = useState<SiteContent | null>(null)
  useEffect(() => { getSiteContent().then(setContent).catch(() => undefined); }, [])

  const isDark = theme === "dark"

  const handleSearchClick = () => {
    setSearchActive(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const navigateToSearch = () => {
    if (query.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") navigateToSearch()
    if (e.key === "Escape") {
      setSearchActive(false)
      setQuery("")
    }
  }

  return (
    <section className="relative flex min-h-[clamp(34rem,72svh,48rem)] flex-col items-center justify-center overflow-hidden px-5 py-20 sm:min-h-[clamp(38rem,76svh,54rem)] sm:px-6 sm:py-24 lg:min-h-[clamp(42rem,78svh,58rem)] lg:px-10 lg:py-28 2xl:min-h-[min(82svh,64rem)] 2xl:px-16 2xl:py-36">

      {/* Background photo — let it breathe */}
      <div className="absolute inset-0">
        <img
          src={content?.hero_image_url || "/hero.jpg"}
          alt="Library interior"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Theme-aware overlay — tints, doesn't bury */}
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{
          background: isDark
            ? "linear-gradient(105deg, hsl(0 100% 12% / 0.92) 0%, hsl(0 100% 18% / 0.82) 55%, hsl(0 100% 25.1% / 0.55) 100%)"
            : "linear-gradient(105deg, hsl(0 100% 25.1% / 0.78) 0%, hsl(0 100% 31% / 0.60) 55%, hsl(0 100% 37% / 0.25) 100%)",
        }}
      />

      {/* Louvered line texture — disciplined, not decorative */}
      <div
        className="absolute inset-0 opacity-[0.04] transition-opacity duration-300"
        style={{
          backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
        }}
      />

      {/* Gold spine — left edge, always present */}
      <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
      <div
        className="absolute inset-y-0 left-[3px] w-20 opacity-[0.07]"
        style={{ background: "linear-gradient(90deg, hsl(var(--warning)), transparent)" }}
      />

      {/* Content — left-anchored like institutional signage */}
      <div className="container relative z-10 max-w-4xl 2xl:max-w-6xl">

        {/* Cornerstone label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex items-center gap-3"
        >
          <div className="h-px w-8 bg-warning" />
          <span
            className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {content?.hero_kicker || "Manuel S. Enverga University Foundation — Candelaria Inc."}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl 2xl:text-7xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {content?.hero_title || "Enverga-Candelaria"}
          <br />
          <span className="text-warning">{content?.hero_highlight || "Library"}</span>
        </motion.h1>

        {/* Subordinate descriptor */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 max-w-xl text-[15px] leading-7 text-white/75 2xl:max-w-2xl 2xl:text-base 2xl:leading-8"
        >
          {content?.hero_description || "Digitalized inventory tracking, book reservations, and seamless access to library services — built for academic excellence."}
        </motion.p>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mt-10 2xl:mt-12"
        >
          <div
            onClick={!searchActive ? handleSearchClick : undefined}
            className={`relative flex h-12 max-w-lg cursor-text items-center border px-4 transition-colors duration-200 ${
              searchActive
                ? "border-warning/50 bg-black/20"
                : isDark
                  ? "border-white/15 bg-white/8 hover:border-white/25"
                  : "border-white/30 bg-white/12 hover:border-white/45"
            }`}
          >
            <Search className="mr-3 h-4 w-4 shrink-0 text-white/40" />

            {searchActive ? (
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (!query) setSearchActive(false) }}
                placeholder="Search books, authors, subjects…"
                className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-white/35"
              />
            ) : (
              <span className="text-sm text-white/40">
                Search the catalogue
              </span>
            )}

            {searchActive && query && (
              <button
                onClick={navigateToSearch}
                className="ml-2 flex items-center gap-1 text-[10px] font-bold tracking-[0.15em] uppercase text-warning hover:text-warning/75 transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Search <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.42 }}
          className="mt-6 flex flex-col items-start gap-3 sm:flex-row 2xl:mt-8"
        >
          <Link to="/catalogue">
            <button
              className="flex items-center gap-2 bg-warning px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase text-foreground transition-colors duration-200 hover:bg-warning/85 focus-visible:ring-offset-primary"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Browse Catalogue
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>

          {!loading && (
            <Link to={isLoggedIn ? "/my-library" : "/login"}>
              <button
                className="flex items-center gap-2 border border-white/35 px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase text-white/80 transition-colors duration-200 hover:border-white/65 hover:text-white focus-visible:ring-offset-primary"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {isLoggedIn ? "Go to My Library" : "Login for Reservation"}
              </button>
            </Link>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex flex-wrap items-center gap-0 border-t border-white/15 pt-6 2xl:mt-16 2xl:pt-8"
        >
          {(content?.hero_stats || [
            { value: "12,000+", label: "Volumes" },
            { value: "400+",    label: "Journals" },
            { value: "24/7",    label: "Digital Access" },
          ]).map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col pr-8 ${i > 0 ? "pl-8 border-l border-white/12" : ""}`}
            >
              <span
                className="text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stat.value}
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 mt-0.5">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default HeroSection
