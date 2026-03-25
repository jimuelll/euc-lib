import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Globe, ExternalLink, BookOpen } from "lucide-react";

const subscriptions = [
  {
    id: 1,
    title: "AccessEngineering",
    url: "https://www.accessengineeringlibrary.com/front",
    description:
      "AccessEngineering is a trusted collection of critical engineering reference information from McGraw-Hill. Covers all major engineering disciplines.",
    category: "Engineering",
  },
  {
    id: 2,
    title: "Business Expert Press",
    url: "https://www.businessexpertpress.com/",
    description:
      "This database consists of 50 titles of e-books which are all perpetual. Covers business, management, and entrepreneurship topics.",
    category: "Business",
  },
  {
    id: 3,
    title: "JSTOR",
    url: "https://www.jstor.org/",
    description:
      "A digital library of academic journals, books, and primary sources. Provides access to thousands of scholarly articles across multiple disciplines.",
    category: "Multidisciplinary",
  },
  {
    id: 4,
    title: "IEEE Xplore",
    url: "https://ieeexplore.ieee.org/",
    description:
      "IEEE Xplore provides access to technical literature in electrical engineering, computer science, and related technologies.",
    category: "Technology",
  },
  {
    id: 5,
    title: "ScienceDirect",
    url: "https://www.sciencedirect.com/",
    description:
      "Elsevier's platform of peer-reviewed scholarly literature covering scientific, technical, and medical research.",
    category: "Science & Medicine",
  },
  {
    id: 6,
    title: "ProQuest",
    url: "https://www.proquest.com/",
    description:
      "A comprehensive research platform offering dissertations, theses, newspapers, periodicals, and other vital research content.",
    category: "Research",
  },
];

const AcademicSubscriptions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="py-16">
        <div className="container max-w-4xl px-4 sm:px-6">

          {/* ── Page header band ──────────────────────────────────────────── */}
          <div className="bg-primary relative overflow-hidden">
            <div className="h-[3px] w-full bg-warning" />
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-px bg-black/30" />

            <div className="relative z-10 px-6 sm:px-8 py-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-4 bg-warning shrink-0" />
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Enverga-Candelaria Library
                </span>
              </div>

              <div className="flex items-start gap-4">
                <Globe className="h-5 w-5 text-primary-foreground/40 shrink-0 mt-1" />
                <div>
                  <h1
                    className="text-xl font-bold text-primary-foreground leading-tight"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                  >
                    Academic Subscriptions
                  </h1>
                  <p className="mt-1.5 text-[12px] text-primary-foreground/45 leading-relaxed max-w-xl">
                    Full access to the following databases is available 24/7 with your student credentials.
                    Click any resource to visit the platform.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Subscription count label ──────────────────────────────────── */}
          <div className="border border-border border-t-0 px-6 sm:px-8 py-3 bg-muted/30 flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {subscriptions.length} Active Databases
            </span>
            <div className="h-px flex-1 mx-4 bg-border" />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              24/7 Access
            </span>
          </div>

          {/* ── Grid of subscription cards ────────────────────────────────── */}
          <div className="border border-border border-t-0 grid sm:grid-cols-2 divide-y divide-border sm:divide-x sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-border">
            {subscriptions.map((sub, index) => (
              <a
                key={sub.id}
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative bg-card hover:bg-muted/20 transition-colors flex flex-col gap-0 overflow-hidden"
              >
                {/* Gold left accent on hover */}
                <div className="absolute left-0 inset-y-0 w-[3px] bg-transparent group-hover:bg-warning transition-colors" />

                {/* Placeholder thumbnail area */}
                <div className="relative flex items-center justify-center h-24 bg-muted/40 border-b border-border overflow-hidden">
                  {/* Index number — ghosted monumental */}
                  <span
                    className="absolute right-3 bottom-1 text-[48px] font-bold text-foreground/[0.04] select-none leading-none"
                    style={{ fontFamily: "var(--font-heading)" }}
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <BookOpen className="h-7 w-7 text-muted-foreground/20 relative z-10" />
                </div>

                {/* Card body */}
                <div className="flex-1 px-5 pt-4 pb-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors truncate leading-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {sub.title}
                      </h2>
                      {/* Category — sharp rectangular pill */}
                      <span
                        className="mt-1.5 inline-block border border-border bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {sub.category}
                      </span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors mt-0.5" />
                  </div>

                  <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-3">
                    {sub.description}
                  </p>

                  {/* Visit label — appears on hover */}
                  <div className="mt-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-px w-3 bg-warning" />
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Visit Platform
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 text-primary" />
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* ── Footer notice ─────────────────────────────────────────────── */}
          <div className="mt-0 border border-border border-t-0 border-dashed bg-card px-6 py-4 flex items-center gap-3">
            <div className="h-px w-4 bg-border shrink-0" />
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              This list is managed by the library administration and will be updated as new subscriptions are added.
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AcademicSubscriptions;