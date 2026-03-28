import { Globe } from "lucide-react";

const LIBRARY_LABEL = "Enverga-Candelaria Library";
const PAGE_TITLE = "Academic Subscriptions";
const PAGE_SUBTITLE =
  "Full access to the following databases is available 24/7 with your student credentials. Click any resource to visit the platform.";

export const PageHeader = () => (
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
          {LIBRARY_LABEL}
        </span>
      </div>

      <div className="flex items-start gap-4">
        <Globe className="h-5 w-5 text-primary-foreground/40 shrink-0 mt-1" />
        <div>
          <h1
            className="text-xl font-bold text-primary-foreground leading-tight"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
          >
            {PAGE_TITLE}
          </h1>
          <p className="mt-1.5 text-[12px] text-primary-foreground/45 leading-relaxed max-w-xl">
            {PAGE_SUBTITLE}
          </p>
        </div>
      </div>
    </div>
  </div>
);