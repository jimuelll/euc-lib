import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">

      {/* Subtle horizontal line texture — same grammar as primary panels */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 28px, hsl(var(--foreground)) 28px, hsl(var(--foreground)) 29px)",
        }}
      />

      <div className="relative w-full max-w-sm mx-4">

        {/* Gold top bar + left bar — panel header grammar */}
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

          {/* 404 number — monumental, structural */}
          <div className="relative z-10 px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-4 bg-warning shrink-0" />
              <span
                className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Enverga-Candelaria Library
              </span>
            </div>

            <p
              className="text-[80px] font-bold leading-none text-primary-foreground/20 select-none"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.04em" }}
              aria-hidden="true"
            >
              404
            </p>

            <h1
              className="mt-2 text-xl font-bold text-primary-foreground leading-tight"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
            >
              Page Not Found
            </h1>
            <p className="mt-1.5 text-[12px] text-primary-foreground/45 leading-relaxed">
              The resource you requested does not exist or has been moved.
            </p>
          </div>
        </div>

        {/* Body panel */}
        <div className="border border-border border-t-0 bg-card divide-y divide-border">

          {/* Path display */}
          <div className="px-6 py-4">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Requested Path
            </p>
            <code
              className="block text-xs font-mono text-foreground/60 bg-muted px-3 py-2 border border-border truncate"
            >
              {location.pathname}
            </code>
          </div>

          {/* Return home — full-width footer button */}
          <a
            href="/"
            className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-primary/90 transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            ← Return to Home
          </a>
        </div>

      </div>
    </div>
  );
};

export default NotFound;