import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import "./login.css";

const benefits = [
  {
    code: "A·01",
    title: "Track your borrowing",
    detail: "See current loans and due dates at a glance.",
    rotation: "-.8deg",
    offset: "0px",
  },
  {
    code: "A·02",
    title: "Manage reservations",
    detail: "Keep up with requests that are ready for pickup.",
    rotation: ".6deg",
    offset: "14px",
  },
  {
    code: "A·03",
    title: "Stay informed",
    detail: "Library updates and account notifications.",
    rotation: "-.4deg",
    offset: "4px",
  },
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const accountInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const reserving = searchParams.get("for") === "reserve";

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const accountId = id.trim();
    if (!accountId || !password) {
      setError(
        "Enter your library card, employee number or username, and your password.",
      );
      if (!accountId) accountInput.current?.focus();
      else passwordInput.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await login(accountId, password, rememberMe);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="login-shell">
        <a className="login-skip-link" href="#login-id">
          Skip to sign in
        </a>
        <main className="login-page">
          <div className="login-grid">
            <section
              className="login-story"
              aria-labelledby="login-story-heading"
            >
              <div className="login-kicker">Library access</div>
              <h1 id="login-story-heading">
                Your library, <em>ready</em> when you are.
              </h1>
              <p className="login-lead">
                Your loans, reservations and notices, in one place.
              </p>

              <div className="login-benefits">
                {benefits.map(({ code, title, detail, rotation, offset }) => (
                  <div
                    className="login-benefit"
                    key={code}
                    style={
                      {
                        "--benefit-rotation": rotation,
                        "--benefit-offset": offset,
                      } as CSSProperties
                    }
                  >
                    <span className="login-benefit-code" aria-hidden="true">
                      {code}
                    </span>
                    <b>{title}</b>
                    <p>{detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`login-card${error ? " login-shake" : ""}`}
              aria-label="Sign in"
            >
              <div className="login-card-header">
                <p className="login-card-title">Sign In</p>
                <small>Enverga-Candelaria Library</small>
                <div className="login-stamp">
                  Member
                  <br />
                  access
                </div>
              </div>

              <form className="login-form" onSubmit={handleLogin} noValidate>
                {reserving && (
                  <p className="login-context">
                    Sign in to reserve books<span>.</span>
                  </p>
                )}
                {error && (
                  <div className="login-error" role="alert">
                    <svg
                      className="login-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 3l10 18H2zM12 10v5M12 18h.01" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="login-field">
                  <label htmlFor="login-id">Account ID</label>
                  <div className="login-input">
                    <input
                      ref={accountInput}
                      id="login-id"
                      name="username"
                      type="text"
                      value={id}
                      onChange={(event) => setId(event.target.value)}
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                </div>

                <div className="login-field login-password-field">
                  <label htmlFor="login-password">Password</label>
                  <div className="login-input">
                    <input
                      ref={passwordInput}
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={readCapsLock}
                      onKeyUp={readCapsLock}
                      onBlur={() => setCapsLock(false)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      className="login-password-toggle"
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p
                    className="login-caps-lock"
                    role="status"
                    hidden={!capsLock}
                  >
                    Caps Lock is on.
                  </p>
                </div>

                <label className="login-remember">
                  <input
                    id="remember-me"
                    name="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>
                    Keep me signed in
                    <small>Leave this off on shared computers.</small>
                  </span>
                </label>

                <button
                  className="login-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <div className="login-help"><Link to="/forgot-password">Forgot password?</Link></div>

                <div className="login-form-foot">
                  <span>No account? Ask at the front desk.</span>
                  <Link to="/">Back to home</Link>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
