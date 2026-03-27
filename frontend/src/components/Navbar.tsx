import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, Bell, QrCode, LogOut, UserCog, LayoutDashboard, Baby, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { label: "Home",      to: "/",          matchPrefix: false },
  { label: "About",     to: "/about",     matchPrefix: true  },
  { label: "Services",  to: "/services",  matchPrefix: true  },
  { label: "Catalogue", to: "/catalogue", matchPrefix: true  },
  { label: "Bulletin",  to: "/bulletin",  matchPrefix: true  },
];

const ROLES_WITH_MY_LIBRARY  = new Set(["student", "scanner", "staff", "admin", "super_admin"]);
const ROLES_WITH_SCANNER     = new Set(["scanner"]);
const ROLES_WITH_ADMIN_PANEL = new Set(["admin", "super_admin", "staff"]);

const AuthSkeleton = () => (
  <div className="h-8 w-8 bg-primary/20 animate-pulse" />
);

const UserAvatar = ({ initials }: { initials: string }) => (
  <div
    className="h-8 w-8 bg-primary-foreground/15 border border-primary-foreground/30 text-primary-foreground text-[11px] font-bold tracking-widest flex items-center justify-center"
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {initials}
  </div>
);

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout, loading } = useAuth();

  const role       = user?.role ?? "guest";
  const isLoggedIn = !!user && !loading;

  const showMyLibrary    = ROLES_WITH_MY_LIBRARY.has(role);
  const showScannerTools = ROLES_WITH_SCANNER.has(role);
  const showAdminPanel   = ROLES_WITH_ADMIN_PANEL.has(role);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const getInitials = () => {
    if (!user?.name) return "?";
    const parts = user.name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isNavActive = (link: typeof navLinks[number]) => {
    if (!link.matchPrefix) return location.pathname === link.to;
    if (link.to === "/") return location.pathname === "/";
    return location.pathname === link.to || location.pathname.startsWith(link.to + "/");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 bg-primary border-b border-primary-foreground/10">
        {/* Gold rule */}
        <div className="h-[3px] w-full bg-warning" />

        <div className="container flex h-14 items-center justify-between gap-2">

          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-3 group">
            <img
              src="/aa1.ico"
              alt="Logo"
              className="h-8 w-8 object-contain opacity-90 shrink-0"
            />
            <div className="flex flex-col leading-none">
              <span
                className="text-primary-foreground text-[13px] font-bold tracking-[0.12em] uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                EUC Library
              </span>
              <span className="text-primary-foreground/50 text-[9px] tracking-[0.2em] uppercase hidden sm:block">
                Enverga-Candelaria Library
              </span>
            </div>
          </Link>

          {/* Vertical separator */}
          <div className="hidden md:block h-6 w-px bg-primary-foreground/15 mx-2 shrink-0" />

          {/* Desktop nav */}
          <DesktopNav links={navLinks} isNavActive={isNavActive} showMyLibrary={showMyLibrary} />

          <div className="flex-1 hidden md:block" />

          {/* ── Right controls ── */}
          {/*
            Key fix: `shrink-0` on the container prevents it from being
            squeezed by the logo or nav. The burger is always last and has
            an explicit `h-9 w-9` so it can never be pushed out of view.
          */}
          <div className="flex items-center gap-0.5 shrink-0">
            {showScannerTools && <ScannerTools onNavigate={navigate} />}

            <div className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              <ThemeToggle />
            </div>

            {loading ? (
              <AuthSkeleton />
            ) : isLoggedIn ? (
              <>
                {/* Bell — visible on both mobile and desktop */}
                <button className="p-2 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
                  <Bell className="h-4 w-4" />
                </button>
                {/* User dropdown — desktop only, never takes mobile space */}
                <div className="hidden md:block ml-1">
                  <UserDropdown
                    name={user?.name}
                    role={role}
                    initials={getInitials()}
                    showAdminPanel={showAdminPanel}
                    onNavigate={navigate}
                    onLogout={logout}
                  />
                </div>
              </>
            ) : (
              /* Login button — desktop only */
              <div className="hidden md:block ml-2">
                <Link to="/login">
                  <button
                    className="px-4 py-1.5 text-[11px] font-bold tracking-[0.15em] uppercase border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Login
                  </button>
                </Link>
              </div>
            )}

            {/* Burger — fixed dimensions, always last, can never be squeezed */}
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 shrink-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />

          <nav
            className="fixed left-0 right-0 top-[calc(3px+3.5rem)] z-40 bg-primary border-b border-primary-foreground/10 shadow-xl md:hidden overflow-y-auto"
            style={{ maxHeight: "calc(100dvh - 3px - 3.5rem)" }}
          >
            {/* User identity band */}
            {isLoggedIn && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-primary-foreground/10 bg-primary-foreground/5">
                <div
                  className="h-8 w-8 border border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground text-[11px] font-bold tracking-widest flex shrink-0 items-center justify-center"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {getInitials()}
                </div>
                <div>
                  <p
                    className="text-[12px] font-bold tracking-[0.08em] text-primary-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-primary-foreground/50 tracking-[0.15em] uppercase">{role}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <div className="py-1">
              {navLinks.map((link) => (
                <MobileNavLink
                  key={link.to}
                  to={link.to}
                  active={isNavActive(link)}
                  onClick={closeMobile}
                >
                  {link.label}
                </MobileNavLink>
              ))}
              {showMyLibrary && (
                <MobileNavLink to="/my-library" onClick={closeMobile} gold>
                  My Library
                </MobileNavLink>
              )}
            </div>

            {/* Logged-in actions */}
            {isLoggedIn && (
              <>
                <div className="h-px bg-primary-foreground/10 my-1" />
                {showAdminPanel && (
                  <MobileActionButton
                    icon={LayoutDashboard}
                    onClick={() => { navigate("/admin"); closeMobile(); }}
                  >
                    Admin Dashboard
                  </MobileActionButton>
                )}
                <MobileActionButton
                  icon={UserCog}
                  onClick={() => { navigate("/edit-profile"); closeMobile(); }}
                >
                  Edit Profile
                </MobileActionButton>
                <div className="h-px bg-primary-foreground/10 my-1" />
                <MobileActionButton
                  icon={LogOut}
                  onClick={() => { logout(); closeMobile(); }}
                  destructive
                >
                  Logout
                </MobileActionButton>
              </>
            )}

            {!loading && !isLoggedIn && (
              <div className="px-4 pt-2 pb-3">
                <Link to="/login" onClick={closeMobile}>
                  <button
                    className="w-full py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Login
                  </button>
                </Link>
              </div>
            )}
          </nav>
        </>
      )}
    </>
  );
};

// ── Desktop nav ───────────────────────────────────────────────────────────────

const DesktopNav = ({
  links, isNavActive, showMyLibrary,
}: {
  links: typeof navLinks;
  isNavActive: (link: typeof navLinks[number]) => boolean;
  showMyLibrary: boolean;
}) => (
  <nav className="hidden items-center md:flex">
    {links.map((link) => {
      const active = isNavActive(link);
      return (
        <Link
          key={link.to}
          to={link.to}
          className={`relative px-4 h-14 flex items-center text-[11px] font-bold tracking-[0.14em] uppercase transition-colors border-b-2 ${
            active
              ? "text-primary-foreground border-warning"
              : "text-primary-foreground/55 hover:text-primary-foreground/90 border-transparent hover:border-primary-foreground/20"
          }`}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {link.label}
        </Link>
      );
    })}
    {showMyLibrary && (
      <Link
        to="/my-library"
        className="relative px-4 h-14 flex items-center text-[11px] font-bold tracking-[0.14em] uppercase text-warning/90 hover:text-warning border-b-2 border-transparent hover:border-warning/50 transition-colors"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        My Library
      </Link>
    )}
  </nav>
);

// ── User dropdown ─────────────────────────────────────────────────────────────

const UserDropdown = ({
  name, role, initials, showAdminPanel, onNavigate, onLogout,
}: {
  name?: string;
  role: string;
  initials: string;
  showAdminPanel: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="flex items-center gap-2 px-2 py-1.5 hover:bg-primary-foreground/10 transition-colors">
        <UserAvatar initials={initials} />
        <ChevronDown className="h-3 w-3 text-primary-foreground/40" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="rounded-none border-border/60 shadow-lg min-w-[200px]">
      <div className="px-3 py-2.5 bg-primary border-b border-border/30">
        <p
          className="text-[12px] font-bold tracking-[0.1em] uppercase text-primary-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {name}
        </p>
        <p className="text-[10px] text-primary-foreground/55 tracking-[0.15em] uppercase mt-0.5">{role}</p>
      </div>
      <div className="py-1">
        {showAdminPanel && (
          <DropdownMenuItem onClick={() => onNavigate("/admin")} className="rounded-none text-[12px] tracking-wide">
            <LayoutDashboard className="mr-2.5 h-3.5 w-3.5" />
            Admin Dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onNavigate("/edit-profile")} className="rounded-none text-[12px] tracking-wide">
          <UserCog className="mr-2.5 h-3.5 w-3.5" />
          Edit Profile
        </DropdownMenuItem>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout} className="rounded-none text-[12px] tracking-wide text-destructive focus:text-destructive">
        <LogOut className="mr-2.5 h-3.5 w-3.5" />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ── Scanner tools ─────────────────────────────────────────────────────────────

const ScannerTools = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
  <>
    <button
      className="p-2 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
      onClick={() => onNavigate("/scan-qr")}
    >
      <QrCode className="h-4 w-4" />
    </button>
    <button
      className="p-2 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
      onClick={() => onNavigate("/scan-qr")}
    >
      <Baby className="h-4 w-4" />
    </button>
  </>
);

// ── Mobile primitives ─────────────────────────────────────────────────────────

const MobileNavLink = ({
  to, active, gold, onClick, children,
}: {
  to: string;
  active?: boolean;
  gold?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center px-4 py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase transition-colors border-l-2 ${
      active
        ? "border-warning text-primary-foreground bg-primary-foreground/[0.08]"
        : gold
          ? "border-transparent text-warning/80 hover:text-warning hover:border-warning/50"
          : "border-transparent text-primary-foreground/55 hover:text-primary-foreground/90 hover:bg-primary-foreground/5"
    }`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </Link>
);

const MobileActionButton = ({
  icon: Icon, onClick, destructive, children,
}: {
  icon: React.ElementType;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center px-4 py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase transition-colors border-l-2 border-transparent hover:bg-primary-foreground/5 ${
      destructive
        ? "text-destructive-foreground/70 hover:border-destructive"
        : "text-primary-foreground/55 hover:text-primary-foreground/90"
    }`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    <Icon className="mr-3 h-3.5 w-3.5" />
    {children}
  </button>
);

export default Navbar;