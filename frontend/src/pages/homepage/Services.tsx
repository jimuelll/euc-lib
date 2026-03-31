import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, Lock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";

const services = [
  {
    icon: BookOpen,
    title: "Borrowing & Reservation",
    description:
      "Borrow up to 5 books at a time with a 14-day lending period. Reserve books online before visiting — held for 48 hours. Track active borrows, reservations, and your full return history. Returns accepted at the front desk or the 24-hour drop-off box.",
    requiresLogin: true,
    link: "/services/borrowing",
  },
  {
    icon: GraduationCap,
    title: "Academic Subscriptions",
    description:
      "Full access to JSTOR, IEEE Xplore, ScienceDirect, and other academic databases for research and scholarly articles. Available 24/7 with your credentials.",
    requiresLogin: true,
    link: "/services/subscriptions",
    note: "Placeholder — Subscriptions will be configurable by admin.",
  },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="h-px w-6 bg-warning shrink-0" />
    <p
      className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  </div>
);

const Services = () => {
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Page header band ── */}
      <div className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        <div className="relative z-10 h-[3px] w-full bg-warning" />
        <div
          className="absolute inset-0 z-10 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="absolute inset-y-0 left-0 z-10 w-[3px] bg-warning" />
        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-black/30" />

        <div className="container relative z-20 px-4 sm:px-6 py-14 md:py-16">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-6 bg-warning shrink-0" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Enverga-Candelaria Library
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-primary-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Library Services
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/50 max-w-lg leading-relaxed">
            Explore the services we offer to support your academic journey.
          </p>
        </div>
      </div>

      <main className="bg-background">
        <div className="border-b border-border py-8 sm:py-10">
          <div className="container px-4 sm:px-6">
            <div
              className="border-l border-t border-border"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}
            >
              {services.map((s, index) => {
                const Icon = s.icon;
                const needsAuth = s.requiresLogin && !isLoggedIn;
                const href = needsAuth ? "/login" : (s.link ?? "/");

                return (
                  <div
                    key={s.title}
                    className="border-r border-b border-border bg-background flex flex-col"
                    style={{ padding: "3.5rem 3.75rem" }}
                  >
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex h-11 w-11 items-center justify-center bg-primary border border-primary/20 shrink-0">
                        <Icon className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span
                        className="text-[10px] font-bold tracking-[0.2em] text-border"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex-1 border-t border-border pt-7">
                      <SectionLabel>{s.requiresLogin ? "Requires Login" : "Open Access"}</SectionLabel>
                      <h2 className="text-xl font-bold tracking-tight text-foreground mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                        {s.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                      {s.note && <p className="mt-3 text-xs text-muted-foreground/60 italic">{s.note}</p>}
                    </div>

                    <div className="border-t border-border mt-10 pt-6">
                      <Link to={href}>
                        <button
                          className="group flex w-full items-center justify-between px-5 py-3.5 border text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-150"
                          style={{
                            fontFamily: "var(--font-heading)",
                            ...(needsAuth
                              ? { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))", backgroundColor: "transparent" }
                              : { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", backgroundColor: "hsl(var(--primary))" }),
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = needsAuth
                              ? "hsl(var(--secondary))"
                              : "hsl(var(--primary) / 0.85)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = needsAuth
                              ? "transparent"
                              : "hsl(var(--primary))";
                          }}
                        >
                          <span>{needsAuth ? "Login to Access" : "View Service"}</span>
                          {needsAuth
                            ? <Lock className="h-3.5 w-3.5" />
                            : <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                          }
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Services;
