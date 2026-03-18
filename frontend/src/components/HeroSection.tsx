import { useState, useRef } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useTheme } from "@/hooks/use-theme"

const HeroSection = () => {
  const [searchActive, setSearchActive] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()

  const isDark = theme === "dark"

  const handleSearchClick = () => {
    setSearchActive(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const navigateToSearch = () => {
    if (query.trim()) {
      window.location.href = `/catalogue?q=${encodeURIComponent(query.trim())}`
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
    <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-32 md:py-40">

      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/hero.jpg"
          alt="Library interior"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Overlay */}
      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-black/60 backdrop-blur-[2px]"
            : "bg-white/60 backdrop-blur-[2px]"
        }`}
      />

      {/* Subtle maroon tint */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(120deg, hsl(0 100% 22% / 0.08), transparent 60%)"
        }}
      />

      <div className="container relative z-10 max-w-3xl text-center">

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className={`font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl ${
            isDark ? "text-white" : "text-foreground"
          }`}
        >
          Enverga-Candelaria Library
        </motion.h1>

        {/* Text */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className={`mt-3 text-base sm:text-lg ${
            isDark ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          Your gateway to knowledge, research, and academic excellence.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className={`mt-1.5 text-sm ${
            isDark ? "text-white/60" : "text-muted-foreground/70"
          }`}
        >
          Digitalized inventory tracking, book reservations, and seamless access
          to library services.
        </motion.p>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-8"
        >
          <div
            onClick={!searchActive ? handleSearchClick : undefined}
            className={`relative mx-auto flex h-12 max-w-xl cursor-text items-center rounded-md border px-4 transition-all duration-200 ${
              isDark
                ? `bg-white/10 border-white/20 hover:border-white/30 backdrop-blur-xl ${
                    searchActive ? "ring-2 ring-white/20 border-white/40" : ""
                  }`
                : `bg-white/70 border-black/10 hover:border-black/20 shadow-sm shadow-black/10 backdrop-blur-xl ${
                    searchActive ? "ring-2 ring-primary/20 border-primary/40" : ""
                  }`
            }`}
          >
            <Search
              className={`mr-3 h-5 w-5 ${
                isDark ? "text-white/70" : "text-muted-foreground"
              }`}
            />

            {searchActive ? (
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!query) setSearchActive(false)
                }}
                placeholder="Search books, authors, subjects..."
                className={`flex-1 bg-transparent text-sm outline-none ${
                  isDark
                    ? "text-white placeholder:text-white/50"
                    : "text-foreground placeholder:text-muted-foreground"
                }`}
              />
            ) : (
              <span
                className={`text-sm ${
                  isDark ? "text-white/60" : "text-muted-foreground"
                }`}
              >
                Search Catalogue
              </span>
            )}
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link to="/catalogue">
            <Button size="lg" className="shadow-lg shadow-primary/30">
              Browse Catalogue
            </Button>
          </Link>

          <Link to="/login">
            <Button
              variant="outline"
              size="lg"
              className={
                isDark
                  ? "border-white/30 text-white bg-white/10 backdrop-blur-sm hover:bg-white/20"
                  : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
              }
            >
              Login for Reservation
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export default HeroSection