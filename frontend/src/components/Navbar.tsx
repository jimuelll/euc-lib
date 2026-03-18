import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Bell,
  QrCode,
  LogOut,
  UserCog,
  LayoutDashboard,
  Baby,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { jwtDecode } from "jwt-decode";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Catalogue", to: "/catalogue" },
  { label: "Bulletin", to: "/bulletin" },
];

interface DecodedToken {
  id: number;
  role: string;
  name: string;
  must_change_password?: boolean;
  exp?: number;
}

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const token = localStorage.getItem("token");

  // ✅ Decode token safely
  const decoded: DecodedToken | null = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode<DecodedToken>(token);
    } catch {
      localStorage.removeItem("token");
      return null;
    }
  }, [token]);

  const role = decoded?.role ?? "guest";
  const isLoggedIn = !!decoded;

  // ✅ Role-based UI
  const showMyLibrary = role === "student";
  const showScannerTools = role === "scanner";
  const showAdminReturn = role === "admin" || role === "super_admin";

  // ✅ Avatar initials (production-ready)
  const getInitials = () => {
    if (!decoded?.name) return "?";

    const parts = decoded.name.trim().split(" ").filter(Boolean);

    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();

    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 font-heading text-lg font-semibold text-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <img src="/aa1.ico" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <span>EUC Library</span>
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
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
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
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              My Library
            </Link>
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {showScannerTools && (
            <>
              <Button variant="ghost" size="icon">
                <QrCode className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Baby className="h-5 w-5" />
              </Button>
            </>
          )}

          <ThemeToggle />

          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center transition-transform hover:scale-105">
                    {getInitials()}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  {/* Greeting */}
                  <div className="px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      Hello, {decoded?.name ?? role}
                    </p>
                  </div>

                  {showAdminReturn && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => navigate("/edit-profile")}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Edit Profile
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t bg-background px-4 pb-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent ${
                location.pathname === link.to
                  ? "text-primary"
                  : "text-muted-foreground"
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

          {!isLoggedIn && (
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="mt-2 w-full">
                Login
              </Button>
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;