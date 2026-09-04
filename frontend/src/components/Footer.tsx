import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-primary-foreground/15 bg-primary">

      <div className="h-[2px] w-full bg-warning" />

      <div className="container relative z-10 px-5 py-12 sm:px-8 lg:px-12 xl:px-16">

        {/* ── Main grid ── */}
        <div className="grid gap-0 border-l border-t border-primary-foreground/15 md:grid-cols-[1.45fr_.8fr_.8fr_1.1fr]">

          {/* Brand column */}
          <div className="border-r border-b border-primary-foreground/15 p-7 md:col-span-1 md:p-8">
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
                className="text-[9px] tracking-[0.2em] uppercase text-primary-foreground/60 ml-9"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Enverga-Candelaria Library
              </p>
            </div>

            <p className="max-w-xs text-sm leading-6 text-primary-foreground/75 mt-6">
              Supporting learning, research, and discovery at every step of the academic journey.
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
        <div className="flex flex-col items-center justify-between gap-3 border-x border-b border-primary-foreground/15 px-7 py-4 sm:flex-row sm:px-8">
          <p
            className="text-[10px] tracking-[0.15em] uppercase text-primary-foreground/55"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            © {new Date().getFullYear()} EUC Library Management System
          </p>
          <p
            className="text-[10px] tracking-[0.15em] uppercase text-warning/85"
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
  <div className="flex flex-col gap-0 border-r border-b border-primary-foreground/15 p-7 md:p-8">
    {/* Column header — like a brass nameplate */}
    <h4
      className="text-[10px] font-bold uppercase tracking-[0.25em] text-warning mb-5"
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
    className="text-xs tracking-wide text-primary-foreground/75 transition-colors duration-200 hover:text-warning"
  >
    {children}
  </Link>
);

const FooterSpan = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs tracking-wide text-primary-foreground/70">
    {children}
  </span>
);

export default Footer;
