import { useId, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSiteContent } from "../useSiteContent";

const HeroPhotograph = ({ source }: { source: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(source);
  return (
    <div className="homepage-hero-image">
      <div className="homepage-hero-photo-print">
        {imageUrl && <img src={imageUrl} alt="Bookshelves inside the Enverga-Candelaria Library" onError={() => setImageUrl(imageUrl === "/hero.jpg" ? null : "/hero.jpg")} />}
      </div>
    </div>
  );
};

const HeroSection = () => {
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const { data: content } = useSiteContent();
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();
  const imageSource = content?.hero_image_url || "/hero.jpg";

  const submitSearch = () => {
    const term = query.trim();
    if (!term) {
      setSearchError(true);
      inputRef.current?.focus();
      return;
    }
    setSearchError(false);
    navigate(`/catalogue?q=${encodeURIComponent(term)}`);
  };

  const stats = content?.hero_stats || [
    { value: "12,000+", label: "Volumes" },
    { value: "400+", label: "Journals" },
    { value: "24/7", label: "Digital Access" },
  ];

  return (
    <section
      className="homepage-hero"
      style={{ "--hero-photograph": `url(${JSON.stringify(imageSource)})` } as CSSProperties}
    >
      <div className="homepage-hero-introduction">
        <div className="homepage-hero-copy">
          <p className="homepage-hero-institution">
            {content?.hero_kicker || "Manuel S. Enverga University Foundation — Candelaria Inc."}
          </p>
          <h1 className="homepage-hero-title">
            {content?.hero_title || "Enverga-Candelaria"}{" "}
            <span>{content?.hero_highlight || "Library"}</span>
          </h1>
          <p className="homepage-hero-description">
            {content?.hero_description || "Discover, reserve, and access the university’s academic collection."}
          </p>
          <form className="homepage-hero-search" role="search" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
            <label htmlFor={searchId} className="homepage-hero-search-label">Search the catalogue</label>
            <div className="homepage-hero-search-controls">
              <div className="homepage-hero-search-field">
                <Search className="h-5 w-5 shrink-0 homepage-hero-search-icon" aria-hidden="true" />
                <input
                  id={searchId}
                  ref={inputRef}
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSearchError(false); }}
                  onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setSearchError(false); } }}
                  placeholder="Search the catalogue"
                  aria-invalid={searchError || undefined}
                  aria-describedby={searchError ? `${searchId}-error` : undefined}
                  className="homepage-hero-search-input"
                />
              </div>
              <button type="submit" className="homepage-hero-search-submit">
                Search <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
            {searchError && <p id={`${searchId}-error`} role="alert" className="homepage-hero-search-error">Enter a search term.</p>}
          </form>
          <div className="homepage-hero-actions">
            <Link to="/services" className="homepage-hero-services">
              Explore library services <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
            <div className="homepage-hero-member">
              {loading ? <span className="homepage-hero-member-placeholder" aria-hidden="true" /> : (
                <Link to={isLoggedIn ? "/my-library" : "/login"}>
                  {isLoggedIn ? "Go to My Library" : "Login for Reservation"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <HeroPhotograph key={imageSource} source={imageSource} />

      <div className="homepage-hero-statistics">
        <dl className="homepage-hero-stats">
          {stats.map((stat, index) => (
            <div key={index} className="homepage-hero-stat">
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default HeroSection;
