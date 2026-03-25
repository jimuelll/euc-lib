import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative bg-primary border-t border-primary-foreground/10 overflow-hidden">

      {/* Gold top rule — sealing the page like a document's closing line */}
      <div className="h-[3px] w-full bg-warning" />

      {/* Louvered texture — same grammar as hero and about section */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
        }}
      />

      <div className="container relative z-10 px-4 sm:px-6 py-14">

        {/* ── Main grid ── */}
        <div className="grid gap-0 border-l border-t border-primary-foreground/10 md:grid-cols-4">

          {/* Brand column */}
          <div className="border-r border-b border-primary-foreground/10 p-8 md:col-span-1">
            {/* Wordmark */}
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center border border-primary-foreground/25 bg-primary-foreground/10">
                  <img
                    src="/aa1.ico"
                    alt="Logo"
                    className="h-8 w-8 object-contain opacity-90"
                  />
                </div>
                <span
                  className="text-[13px] font-bold tracking-[0.12em] uppercase text-primary-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  EUC Library
                </span>
              </div>
              <p
                className="text-[9px] tracking-[0.2em] uppercase text-primary-foreground/40 ml-9"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Enverga-Candelaria Library
              </p>
            </div>

            <p className="text-xs text-primary-foreground/50 leading-relaxed mt-5">
              Modernizing library operations through digital solutions for students and staff.
            </p>
          </div>

          {/* Quick Links */}
          <FooterColumn title="Quick Links">
            <FooterLink to="/">Home</FooterLink>
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/services">Services</FooterLink>
            <FooterLink to="/catalogue">Catalogue</FooterLink>
          </FooterColumn>

          {/* Resources */}
          <FooterColumn title="Resources">
            <FooterLink to="/bulletin">Bulletin</FooterLink>
            <FooterLink to="/login">Login</FooterLink>
            <FooterSpan>Privacy Policy</FooterSpan>
            <FooterSpan>Terms of Use</FooterSpan>
          </FooterColumn>

          {/* Contact */}
          <FooterColumn title="Contact">
            <FooterSpan>123 University Avenue</FooterSpan>
            <FooterSpan>Building C, 2nd Floor</FooterSpan>
            <FooterSpan>library@college.edu</FooterSpan>
            <FooterSpan>(555) 123-4567</FooterSpan>
          </FooterColumn>

        </div>

        {/* ── Bottom bar ── */}
        <div className="border-l border-r border-b border-primary-foreground/10 px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p
            className="text-[10px] tracking-[0.15em] uppercase text-primary-foreground/30"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            © {new Date().getFullYear()} EUC Library Management System
          </p>
          <p
            className="text-[10px] tracking-[0.15em] uppercase text-primary-foreground/20"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            All rights reserved
          </p>
        </div>

      </div>
    </footer>
  );
};

// ─── Footer primitives ────────────────────────────────────────────────────────

const FooterColumn = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border-r border-b border-primary-foreground/10 p-8 flex flex-col gap-0">
    {/* Column header — like a brass nameplate */}
    <h4
      className="text-[10px] font-bold uppercase tracking-[0.25em] text-warning/80 mb-5"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {title}
    </h4>
    <nav className="flex flex-col gap-3">
      {children}
    </nav>
  </div>
);

const FooterLink = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    className="text-xs text-primary-foreground/50 hover:text-primary-foreground transition-colors tracking-wide"
  >
    {children}
  </Link>
);

const FooterSpan = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs text-primary-foreground/40 tracking-wide">
    {children}
  </span>
);

export default Footer;