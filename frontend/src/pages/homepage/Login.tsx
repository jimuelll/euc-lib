import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, EyeOff, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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

  const { login } = useAuth(); // ← use AuthContext, not raw fetch

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!id || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(id, password); // ← this sets user, inMemoryToken, and navigates
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="flex items-center justify-center py-24 px-4">
        <div className="w-full max-w-md">
          <div className="text-center">
            <BookOpen className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to access library services</p>
          </div>

          <div className="mt-8 rounded-lg border bg-card p-6">
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="text-sm font-medium text-foreground">ID Number</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="Enter your student or employee ID"
                  className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-md border bg-background px-3 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Remember me</span>
                </label>

                <HoverCard>
                  <HoverCardTrigger asChild>
                    <button type="button" className="flex items-center gap-1 text-sm text-primary hover:underline">
                      Forgot password?
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-72 text-sm">
                    <p className="font-heading font-medium text-foreground">Password Reset Assistance</p>
                    <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                      Visit the library front desk with a valid ID.
                    </p>
                  </HoverCardContent>
                </HoverCard>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" size="lg" type="submit" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">← Back to Home</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;