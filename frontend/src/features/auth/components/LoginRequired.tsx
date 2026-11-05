import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LibraryDesignProvider } from "@/components/ui/library-design";
import { ArrowRight } from "@/components/ui/library-glyphs";
import { useAuth } from "@/context/AuthContext";
import { loginDestination } from "@/utils/authDestination";
import "./login-required.css";

export type LoginRequiredOptions = {
  /** Heading, e.g. "Sign in to join the discussion". */
  title?: string;
  /** One sentence explaining why an account is needed. */
  message?: string;
  /** Where to land after signing in. Defaults to the current page. */
  returnTo?: string;
};

type LoginRequiredContextValue = { requireLogin: (options?: LoginRequiredOptions) => void };

const LoginRequiredContext = createContext<LoginRequiredContextValue>({ requireLogin: () => {} });

const DEFAULTS = {
  title: "Sign in to continue",
  message: "This part of the library needs your library account.",
};

export function LoginRequiredProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<LoginRequiredOptions | null>(null);
  const { pathname, search, hash } = useLocation();
  const { isLoggedIn } = useAuth();
  const here = pathname + search + hash;

  const requireLogin = useCallback((next?: LoginRequiredOptions) => setOptions(next ?? {}), []);
  const close = useCallback(() => setOptions(null), []);
  const value = useMemo(() => ({ requireLogin }), [requireLogin]);

  useEffect(() => { setOptions(null); }, [pathname]);
  useEffect(() => { if (isLoggedIn) setOptions(null); }, [isLoggedIn]);

  return <LoginRequiredContext.Provider value={value}>
    {children}
    <LibraryDesignProvider>
      <Dialog open={options !== null} onOpenChange={open => { if (!open) close(); }}>
        <DialogContent className="login-required" hideClose>
          <div className="login-required-kicker">Library account</div>
          <DialogTitle className="login-required-title">{options?.title ?? DEFAULTS.title}</DialogTitle>
          <DialogDescription className="login-required-message">{options?.message ?? DEFAULTS.message}</DialogDescription>
          <div className="login-required-actions">
            <Link className="login-required-submit" to={loginDestination(options?.returnTo ?? here)} onClick={close}>
              Sign in<ArrowRight aria-hidden="true" />
            </Link>
            <button type="button" className="login-required-dismiss" onClick={close}>Not now</button>
          </div>
          <p className="login-required-foot">No account? Ask at the front desk.</p>
        </DialogContent>
      </Dialog>
    </LibraryDesignProvider>
  </LoginRequiredContext.Provider>;
}

export const useLoginRequired = () => useContext(LoginRequiredContext);
