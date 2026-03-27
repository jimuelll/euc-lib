interface AboutHeaderProps {
  libraryName: string;
}

const AboutHeader = ({ libraryName }: AboutHeaderProps) => (
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
          {libraryName}
        </span>
      </div>
      <h1
        className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-primary-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        About the Library
      </h1>
      <p className="mt-3 text-sm text-primary-foreground/50 max-w-lg leading-relaxed">
        Our history, mission, staff, and facilities — everything you need to know about the{" "}
        {libraryName}.
      </p>
    </div>
  </div>
);

export default AboutHeader;