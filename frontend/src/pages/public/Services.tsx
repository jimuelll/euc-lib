import { Link } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";

const services = [
  {
    title: "Borrowing & Returning",
    description:
      "Borrow up to 5 books at a time with a 14-day lending period for students. View your borrowing logs and return history. Returns can be made at the front desk or the 24-hour drop-off box.",
    requiresLogin: true,
    link: "/services/borrowing",
  },
  {
    title: "Digital Reservation System",
    description:
      "Reserve books online before visiting the library. Reserved books are held for 48 hours. Track your active and past reservations.",
    requiresLogin: true,
    link: "/services/reservation",
  },
  {
    title: "Academic Subscriptions",
    description:
      "Full access to JSTOR, IEEE Xplore, ScienceDirect, and other academic databases for research and scholarly articles. Available 24/7 with your credentials.",
    requiresLogin: false,
    link: "/services/subscriptions",
    note: "Placeholder — Subscriptions will be configurable by admin.",
  },
  {
    title: "Online Database Subscriptions",
    description:
      "Access thousands of e-books and digital resources through our partnered platforms. Browse available databases and access scholarly materials.",
    requiresLogin: false,
  },
];

const Services = () => {
  const { isLoggedIn } = useRole();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Library Services</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Explore the services we offer to support your academic journey.
          </p>

          <div className="mt-12 space-y-6">
            {services.map((s) => (
              <div key={s.title} className="rounded-lg border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="font-heading text-lg font-medium text-foreground">{s.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                    {s.note && (
                      <p className="mt-2 text-xs text-muted-foreground/70 italic">{s.note}</p>
                    )}
                    {s.link && !s.requiresLogin && (
                      <Link to={s.link}>
                        <Button size="sm" variant="outline" className="mt-3 gap-1.5">
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                  {s.requiresLogin && (
                    <Link to={isLoggedIn ? (s.link || "/") : "/login"}>
                      <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                        {isLoggedIn ? (
                          <>
                            View <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            Login Required
                          </>
                        )}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Services;
