import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Globe, ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscriptions = [
  {
    id: 1,
    title: "AccessEngineering",
    url: "https://www.accessengineeringlibrary.com/front",
    description:
      "AccessEngineering is a trusted collection of critical engineering reference information from McGraw-Hill. Covers all major engineering disciplines.",
    category: "Engineering",
  },
  {
    id: 2,
    title: "Business Expert Press",
    url: "https://www.businessexpertpress.com/",
    description:
      "This database consists of 50 titles of e-books which are all perpetual. Covers business, management, and entrepreneurship topics.",
    category: "Business",
  },
  {
    id: 3,
    title: "JSTOR",
    url: "https://www.jstor.org/",
    description:
      "A digital library of academic journals, books, and primary sources. Provides access to thousands of scholarly articles across multiple disciplines.",
    category: "Multidisciplinary",
  },
  {
    id: 4,
    title: "IEEE Xplore",
    url: "https://ieeexplore.ieee.org/",
    description:
      "IEEE Xplore provides access to technical literature in electrical engineering, computer science, and related technologies.",
    category: "Technology",
  },
  {
    id: 5,
    title: "ScienceDirect",
    url: "https://www.sciencedirect.com/",
    description:
      "Elsevier's platform of peer-reviewed scholarly literature covering scientific, technical, and medical research.",
    category: "Science & Medicine",
  },
  {
    id: 6,
    title: "ProQuest",
    url: "https://www.proquest.com/",
    description:
      "A comprehensive research platform offering dissertations, theses, newspapers, periodicals, and other vital research content.",
    category: "Research",
  },
];

const AcademicSubscriptions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Academic Subscriptions</h1>
              <p className="text-sm text-muted-foreground">
                Access scholarly databases and digital resources
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Full access to the following academic databases is available 24/7 with your student credentials. Click on any resource to visit the platform.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {subscriptions.map((sub) => (
              <a
                key={sub.id}
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                {/* Placeholder image */}
                <div className="flex h-28 items-center justify-center rounded-md bg-muted mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {sub.title}
                    </h2>
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {sub.category}
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {sub.description}
                </p>

                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Visit Platform <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-dashed bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This list is managed by the library administration and will be updated as new subscriptions are added.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AcademicSubscriptions;
