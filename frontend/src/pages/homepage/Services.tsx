import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, Lock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const services = [
  {
    icon: BookOpen,
    title: "Borrowing & Reservation",
    description:
      "Borrow up to 5 books at a time with a 14-day lending period. Reserve books online before visiting — held for 48 hours. Track active borrows, reservations, and your full return history. Returns accepted at the front desk or the 24-hour drop-off box.",
    requiresLogin: true,
    link: "/services/borrowing",
  },
  {
    icon: GraduationCap,
    title: "Academic Subscriptions",
    description:
      "Full access to JSTOR, IEEE Xplore, ScienceDirect, and other academic databases for research and scholarly articles. Available 24/7 with your credentials.",
    requiresLogin: false,
    link: "/services/subscriptions",
    note: "Placeholder — Subscriptions will be configurable by admin.",
  },
];

const Services = () => {
  const { isLoggedIn } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Library Services
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Explore the services we offer to support your academic journey.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {services.map((s) => {
              const Icon = s.icon;
              const needsAuth = s.requiresLogin && !isLoggedIn;
              const href = needsAuth ? "/login" : (s.link ?? "/");

              return (
                <div
                  key={s.title}
                  className="flex flex-col rounded-xl border bg-card p-6 gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1">
                    <h2 className="font-heading text-lg font-semibold text-foreground">
                      {s.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {s.description}
                    </p>
                    {s.note && (
                      <p className="mt-2 text-xs text-muted-foreground/60 italic">
                        {s.note}
                      </p>
                    )}
                  </div>

                  <Link to={href} className="mt-auto">
                    <Button size="sm" variant="outline" className="gap-1.5 w-full justify-center">
                      {needsAuth ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Login to Access
                        </>
                      ) : (
                        <>
                          View Service
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Services;