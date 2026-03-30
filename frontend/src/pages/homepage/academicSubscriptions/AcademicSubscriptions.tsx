import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useSubscriptions } from "./hooks";
import {
  PageHeader,
  CountBar,
  SubscriptionGrid,
  LoadingState,
  ErrorState,
  EmptyState,
  FooterNotice,
} from "./components";

const AcademicSubscriptions = () => {
  const { isLoggedIn } = useAuth();
  const { subscriptions, status, error } = useSubscriptions();

  const isLoading = isLoggedIn && (status === "loading" || status === "idle");
  const isError = isLoggedIn && status === "error";
  const isEmpty = isLoggedIn && status === "success" && subscriptions.length === 0;
  const hasData = isLoggedIn && status === "success" && subscriptions.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="py-16">
        <div className="container max-w-4xl px-4 sm:px-6">
          <PageHeader />

          {!isLoggedIn ? (
            <div className="border border-border bg-background overflow-hidden">
              <div className="bg-primary relative overflow-hidden px-6 py-6">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-warning" />
                <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
                <div
                  className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
                  }}
                />
                <div className="relative z-10 flex items-center gap-3">
                  <Lock className="h-4 w-4 text-warning" />
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Requires Login
                    </p>
                    <h2
                      className="mt-2 text-xl font-bold tracking-tight text-primary-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Login to Access
                    </h2>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 border-t border-border bg-background">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Sign in to view the library&apos;s academic database subscriptions and access links.
                </p>

                <Link to="/login" className="mt-6 inline-flex">
                  <button
                    className="group flex items-center justify-between gap-3 border border-border px-5 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <span>Login to Access</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <CountBar count={subscriptions.length} loading={isLoading} />

              {isLoading && <LoadingState />}
              {isError && <ErrorState message={error!} />}
              {isEmpty && <EmptyState />}
              {hasData && <SubscriptionGrid subscriptions={subscriptions} />}

              {!isLoading && !isError && <FooterNotice />}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AcademicSubscriptions;
