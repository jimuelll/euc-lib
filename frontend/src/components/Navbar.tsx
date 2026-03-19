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

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Catalogue", to: "/catalogue" },
  { label: "Bulletin", to: "/bulletin" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  const role = user?.role ?? "guest";
  const isLoggedIn = !!user && !loading;

  const showMyLibrary = role === "student";
  const showScannerTools = role === "scanner";
  const showAdminReturn = role === "admin" || role === "super_admin" || role === "staff";

  const getInitials = () => {
    if (!user?.name) return "?";
    const parts = user.name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const AuthSkeleton = () => (
    <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-2">

        {/* Logo — shrink-0 + whitespace-nowrap prevents wrapping */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold text-foreground"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <img src="/aa1.ico" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <span className="whitespace-nowrap">EUC Library</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative text-sm font-medium ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 h-[2px] w-full bg-primary transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`} />
              </Link>
            );
          })}

          {showMyLibrary && (
            <Link to="/my-library" className="text-sm text-muted-foreground hover:text-foreground">
              My Library
            </Link>
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {showScannerTools && (
            <>
              <Button variant="ghost" size="icon"><QrCode className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon"><Baby className="h-5 w-5" /></Button>
            </>
          )}

          <ThemeToggle />

          {loading ? (
            <AuthSkeleton />
          ) : isLoggedIn ? (
            <>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              {/* Desktop only — avatar + chevron dropdown */}
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors">
                      <div className="h-8 w-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
                        {getInitials()}
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{user?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>
                    <DropdownMenuSeparator />
                    {showAdminReturn && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Admin Dashboard
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate("/edit-profile")}>
                      <UserCog className="mr-2 h-4 w-4" />
                      Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            /* Login button — desktop only, mobile handled in menu */
            <div className="hidden md:block">
              <Link to="/login">
                <Button size="sm">Login</Button>
              </Link>
            </div>
          )}

          {/* Burger — always last on mobile */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav — flat list, no conflicting dropdown */}
      {mobileOpen && (
        <nav className="border-t bg-background px-4 pb-4 md:hidden">

          {/* User info card at top when logged in */}
          {isLoggedIn && (
            <>
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="h-9 w-9 rounded-full bg-primary text-white text-xs font-semibold flex shrink-0 items-center justify-center">
                  {getInitials()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role}</p>
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
            </>
          )}

          {/* Nav links */}
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent ${
                location.pathname === link.to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {showMyLibrary && (
            <Link
              to="/my-library"
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              My Library
            </Link>
          )}

          {/* Logged in actions */}
          {isLoggedIn && (
            <>
              <div className="my-1 h-px bg-border" />

              {showAdminReturn && (
                <button
                  onClick={() => { navigate("/admin"); setMobileOpen(false); }}
                  className="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Admin Dashboard
                </button>
              )}

              <button
                onClick={() => { navigate("/edit-profile"); setMobileOpen(false); }}
                className="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                <UserCog className="mr-2 h-4 w-4" />
                Edit Profile
              </button>

              <div className="my-1 h-px bg-border" />

              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium text-destructive hover:bg-accent"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </>
          )}

          {!loading && !isLoggedIn && (
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="mt-2 w-full">Login</Button>
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;