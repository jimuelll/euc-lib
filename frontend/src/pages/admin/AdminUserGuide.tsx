import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpenCheck, CircleHelp, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPanel } from "./components/AdminPage";
import { getPublishedGuide, type GuideModule } from "@/services/user-guide.service";

export default function AdminUserGuide() {
  const [modules, setModules] = useState<GuideModule[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setModules(await getPublishedGuide());
    } catch (err: any) {
      setError(err.response?.data?.message || "The user guide could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const categories = useMemo(
    () => ["All topics", ...Array.from(new Set(modules.map((item) => item.category)))],
    [modules],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return modules.filter((item) => {
      const categoryMatches = category === "All topics" || item.category === category;
      const textMatches = !term || [item.title, item.summary, item.overview, item.category]
        .some((value) => value.toLowerCase().includes(term));
      return categoryMatches && textMatches;
    });
  }, [category, modules, query]);

  return (
    <AdminPage title="User guide" contentWidth="wide">
      <section className="grid gap-5 border-b border-border pb-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-warning">
            <BookOpenCheck className="h-4 w-4" /> Help for your role
          </div>
          <p className="text-base leading-7 text-muted-foreground">
            Find plain-language instructions for the library tools available to your account. Open a topic to see each step.
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Search the user guide</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search the guide" />
        </label>
      </section>

      {!loading && !error && modules.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Guide categories">
          {categories.map((item) => (
            <Button key={item} type="button" size="sm" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)}>
              {item}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? <AdminPanel><p className="py-10 text-center text-sm text-muted-foreground">Loading your guide…</p></AdminPanel> : null}
      {error ? (
        <AdminPanel>
          <div className="flex flex-col items-center py-8 text-center">
            <CircleHelp className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">We could not open the guide</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        </AdminPanel>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <AdminPanel>
          <div className="py-8 text-center">
            <p className="font-medium">No matching guide topics</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different word or choose All topics.</p>
          </div>
        </AdminPanel>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <AdminPanel className="overflow-hidden" contentClassName="p-0">
          <Accordion type="multiple" className="w-full">
            {filtered.map((item) => (
              <AccordionItem key={item.id} value={String(item.id)} className="px-5 last:border-b-0 sm:px-6">
                <AccordionTrigger className="gap-5 py-5 text-left hover:no-underline">
                  <span className="min-w-0">
                    <span className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-foreground">{item.title}</span>
                      <Badge variant="outline" className="rounded-sm font-normal text-muted-foreground">{item.category}</Badge>
                    </span>
                    <span className="block pr-3 text-sm font-normal leading-6 text-muted-foreground">{item.summary}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-7">
                  <article className="max-w-3xl space-y-6 border-t border-border/70 pt-6">
                    {item.image_url ? <img src={item.image_url} alt={`Example screen for ${item.title}`} className="max-h-[26rem] w-full border border-border object-contain" /> : null}
                    <p className="max-w-[70ch] text-sm leading-7 text-foreground/90">{item.overview}</p>

                    {item.before_you_begin.length > 0 ? (
                      <section className="border-l-2 border-primary bg-primary/5 px-4 py-3">
                        <h3 className="font-semibold">Before you begin</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                          {item.before_you_begin.map((note, index) => <li key={index}>{note}</li>)}
                        </ul>
                      </section>
                    ) : null}

                    <section>
                      <h3 className="mb-4 font-semibold">What to do</h3>
                      <ol className="space-y-4">
                        {item.steps.map((step, index) => (
                          <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                            <span className="flex h-8 w-8 items-center justify-center border border-warning/30 bg-warning/10 text-sm font-semibold text-warning">{index + 1}</span>
                            <div><p className="font-medium text-foreground">{step.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p></div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    {item.warnings.length > 0 ? (
                      <section className="border border-warning/35 bg-warning/5 p-4">
                        <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Important</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                          {item.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                        </ul>
                      </section>
                    ) : null}

                    {item.troubleshooting.length > 0 ? (
                      <section>
                        <h3 className="mb-3 font-semibold">If something goes wrong</h3>
                        <div className="divide-y divide-border border-y border-border">
                          {item.troubleshooting.map((tip, index) => <div key={index} className="py-3"><p className="text-sm font-medium">{tip.problem}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{tip.solution}</p></div>)}
                        </div>
                      </section>
                    ) : null}

                    {item.target_path ? <Button asChild variant="outline"><Link to={item.target_path}>Open this module <ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : null}
                  </article>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AdminPanel>
      ) : null}
    </AdminPage>
  );
}
