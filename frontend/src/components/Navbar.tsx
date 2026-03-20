import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu, X, Bell, QrCode, LogOut, UserCog, LayoutDashboard, Baby, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

// ─── Nav links config ─────────────────────────────────────────────────────────
// `matchPrefix: true` keeps the link highlighted for all child routes
// e.g. /services/borrowing still highlights the "Services" link

const navLinks = [
  { label: "Home",      to: "/",          matchPrefix: false },
  { label: "About",     to: "/about",     matchPrefix: true  },
  { label: "Services",  to: "/services",  matchPrefix: true  },
  { label: "Catalogue", to: "/catalogue", matchPrefix: true  },
  { label: "Bulletin",  to: "/bulletin",  matchPrefix: true  },
];

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLES_WITH_MY_LIBRARY  = new Set(["student", "scanner", "staff", "admin", "super_admin"]);
const ROLES_WITH_SCANNER     = new Set(["scanner"]);
const ROLES_WITH_ADMIN_PANEL = new Set(["admin", "super_admin", "staff"]);

// ─── Sub-components ───────────────────────────────────────────────────────────

const AuthSkeleton = () => (
  <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
);

const UserAvatar = ({ initials }: { initials: string }) => (
  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
    {initials}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  const role       = user?.role ?? "guest";
  const isLoggedIn = !!user && !loading;

  const showMyLibrary   = ROLES_WITH_MY_LIBRARY.has(role);
  const showScannerTools = ROLES_WITH_SCANNER.has(role);
  const showAdminPanel  = ROLES_WITH_ADMIN_PANEL.has(role);

  const getInitials = () => {
    if (!user?.name) return "?";
    const parts = user.name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isNavActive = (link: typeof navLinks[number]) => {
    if (!link.matchPrefix) return location.pathname === link.to;
    // For home, only exact match to avoid matching everything
    if (link.to === "/") return location.pathname === "/";
    return location.pathname === link.to || location.pathname.startsWith(link.to + "/");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-2">

        {/* ── Logo ── */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold text-foreground"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <img src="/aa1.ico" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <span className="whitespace-nowrap">EUC Library</span>
        </Link>

        {/* ── Desktop nav ── */}
        <DesktopNav
          links={navLinks}
          isNavActive={isNavActive}
          showMyLibrary={showMyLibrary}
        />

        {/* ── Right controls ── */}
        <div className="flex items-center gap-1">
          {showScannerTools && <ScannerTools />}

          <ThemeToggle />

          {loading ? (
            <AuthSkeleton />
          ) : isLoggedIn ? (
            <>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              {/* Desktop avatar dropdown */}
              <div className="hidden md:block">
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
            <div className="hidden md:block">
              <Link to="/login">
                <Button size="sm">Login</Button>
              </Link>
            </div>
          )}

          {/* Burger */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile nav ── */}
      {mobileOpen && (
        <MobileNav
          links={navLinks}
          isNavActive={isNavActive}
          isLoggedIn={isLoggedIn}
          loading={loading}
          user={user}
          role={role}
          initials={getInitials()}
          showMyLibrary={showMyLibrary}
          showAdminPanel={showAdminPanel}
          onNavigate={navigate}
          onLogout={logout}
          onClose={closeMobile}
        />
      )}
    </header>
  );
};

// ─── Desktop nav ──────────────────────────────────────────────────────────────

const DesktopNav = ({
  links,
  isNavActive,
  showMyLibrary,
}: {
  links: typeof navLinks;
  isNavActive: (link: typeof navLinks[number]) => boolean;
  showMyLibrary: boolean;
}) => (
  <nav className="hidden items-center gap-6 md:flex">
    {links.map((link) => {
      const active = isNavActive(link);
      return (
        <Link
          key={link.to}
          to={link.to}
          className={`relative text-sm font-medium transition-colors ${
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {link.label}
          <span
            className={`absolute -bottom-1 left-0 h-[2px] w-full bg-primary transition-opacity ${
              active ? "opacity-100" : "opacity-0"
            }`}
          />
        </Link>
      );
    })}

    {showMyLibrary && (
      <Link
        to="/my-library"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        My Library
      </Link>
    )}
  </nav>
);

// ─── User dropdown (desktop) ──────────────────────────────────────────────────

const UserDropdown = ({
  name,
  role,
  initials,
  showAdminPanel,
  onNavigate,
  onLogout,
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
      <button className="flex items-center gap-1 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors">
        <UserAvatar initials={initials} />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end">
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>
      <DropdownMenuSeparator />
      {showAdminPanel && (
        <DropdownMenuItem onClick={() => onNavigate("/admin")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Admin Dashboard
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => onNavigate("/edit-profile")}>
        <UserCog className="mr-2 h-4 w-4" />
        Edit Profile
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ─── Scanner tools ────────────────────────────────────────────────────────────

const ScannerTools = () => (
  <>
    <Button variant="ghost" size="icon">
      <QrCode className="h-5 w-5" />
    </Button>
    <Button variant="ghost" size="icon">
      <Baby className="h-5 w-5" />
    </Button>
  </>
);

// ─── Mobile nav ───────────────────────────────────────────────────────────────

const MobileNav = ({
  links,
  isNavActive,
  isLoggedIn,
  loading,
  user,
  role,
  initials,
  showMyLibrary,
  showAdminPanel,
  onNavigate,
  onLogout,
  onClose,
}: {
  links: typeof navLinks;
  isNavActive: (link: typeof navLinks[number]) => boolean;
  isLoggedIn: boolean;
  loading: boolean;
  user: { name?: string } | null;
  role: string;
  initials: string;
  showMyLibrary: boolean;
  showAdminPanel: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onClose: () => void;
}) => (
  <nav className="border-t bg-background px-4 pb-4 md:hidden">

    {/* User info */}
    {isLoggedIn && (
      <>
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex shrink-0 items-center justify-center">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
        <Divider />
      </>
    )}

    {/* Nav links */}
    {links.map((link) => (
      <MobileNavLink
        key={link.to}
        to={link.to}
        active={isNavActive(link)}
        onClick={onClose}
      >
        {link.label}
      </MobileNavLink>
    ))}

    {showMyLibrary && (
      <MobileNavLink to="/my-library" onClick={onClose}>
        My Library
      </MobileNavLink>
    )}

    {/* Logged-in actions */}
    {isLoggedIn && (
      <>
        <Divider />
        {showAdminPanel && (
          <MobileActionButton
            icon={LayoutDashboard}
            onClick={() => { onNavigate("/admin"); onClose(); }}
          >
            Admin Dashboard
          </MobileActionButton>
        )}
        <MobileActionButton
          icon={UserCog}
          onClick={() => { onNavigate("/edit-profile"); onClose(); }}
        >
          Edit Profile
        </MobileActionButton>
        <Divider />
        <MobileActionButton
          icon={LogOut}
          onClick={() => { onLogout(); onClose(); }}
          destructive
        >
          Logout
        </MobileActionButton>
      </>
    )}

    {!loading && !isLoggedIn && (
      <Link to="/login" onClick={onClose}>
        <Button size="sm" className="mt-2 w-full">Login</Button>
      </Link>
    )}
  </nav>
);

// ─── Mobile primitives ────────────────────────────────────────────────────────

const Divider = () => <div className="my-1 h-px bg-border" />;

const MobileNavLink = ({
  to,
  active,
  onClick,
  children,
}: {
  to: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent ${
      active ? "text-primary" : "text-muted-foreground"
    }`}
  >
    {children}
  </Link>
);

const MobileActionButton = ({
  icon: Icon,
  onClick,
  destructive,
  children,
}: {
  icon: React.ElementType;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent ${
      destructive ? "text-destructive" : "text-muted-foreground"
    }`}
  >
    <Icon className="mr-2 h-4 w-4" />
    {children}
  </button>
);

export default Navbar;