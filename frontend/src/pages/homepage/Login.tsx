import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!id || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      await login(id, password, rememberMe);
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="bg-background">
        <div className="container px-4 sm:px-6 py-16 md:py-24 flex items-start justify-center">
          <div className="w-full max-w-sm">
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
              <div className="relative z-10 px-6 py-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px w-4 bg-warning shrink-0" />
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Enverga-Candelaria Library
                  </span>
                </div>
                <h1
                  className="text-xl font-bold text-primary-foreground leading-tight"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                >
                  Library Access
                </h1>
                <p className="mt-1.5 text-[12px] text-primary-foreground/45 leading-relaxed">
                  Sign in with your student or employee credentials.
                </p>
              </div>
            </div>

            <div className="border border-border border-t-0 divide-y divide-border bg-card">
              <div className="px-6 pt-5 pb-4">
                <label
                  className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                  htmlFor="login-id"
                >
                  ID Number <span className="text-destructive">*</span>
                </label>
                <input
                  id="login-id"
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="Student or employee ID"
                  autoComplete="username"
                  className="h-10 w-full border border-border bg-background px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary transition-colors"
                />
              </div>

              <div className="px-6 pt-4 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                    htmlFor="login-password"
                  >
                    Password <span className="text-destructive">*</span>
                  </label>

                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary/70 hover:text-primary transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Forgot?
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm rounded-none border-border bg-card p-0 shadow-2xl">
                      <div className="bg-primary relative overflow-hidden px-6 py-5">
                        <div className="absolute inset-x-0 top-0 h-[3px] bg-warning" />
                        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
                        <div
                          className="absolute inset-0 opacity-[0.04] pointer-events-none"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
                          }}
                        />
                        <DialogHeader className="relative z-10 space-y-3 text-left">
                          <span
                            className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Account Help
                          </span>
                          <DialogTitle
                            className="text-xl font-bold tracking-tight text-primary-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Password Reset
                          </DialogTitle>
                          <DialogDescription className="text-sm leading-6 text-primary-foreground/70">
                            Visit the library front desk with a valid school ID to reset your password.
                          </DialogDescription>
                        </DialogHeader>
                      </div>

                      <div className="px-6 py-5 border-t border-border bg-background">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Staff will verify your identity and issue a new temporary password for your account.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-10 w-full border border-border bg-background px-3.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="px-6 py-3 flex items-center justify-between bg-muted/30">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                      id="remember-me"
                    />
                    <div className="h-4 w-4 border border-border bg-background peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                      {rememberMe && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Remember me
                  </span>
                </label>
              </div>

              {error && (
                <div className="flex gap-0">
                  <div className="w-[3px] bg-destructive shrink-0" />
                  <p
                    className="flex-1 px-4 py-3 text-[11px] text-destructive bg-destructive/[0.04] leading-relaxed"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
                  >
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {loading ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <Link
                to="/"
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Back to Home
              </Link>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Login;
