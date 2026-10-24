import { loginDestination } from "@/utils/authDestination";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "@/components/ui/library-glyphs";
import { Skeleton } from "@/components/ui/skeleton";
import ServiceInnerLayout from "@/components/layout/ServiceInnerLayout";
import { useAuth } from "@/context/AuthContext";
import { useSubscriptions } from "./hooks";
import { SubscriptionGrid } from "./components/SubscriptionGrid";

export default function AcademicSubscriptions() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { subscriptions, status, error, refetch } = useSubscriptions(isLoggedIn);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = [...new Set(subscriptions.map(sub => sub.category).filter((value): value is string => !!value))];
  const filtered = subscriptions.filter(sub => (!category || sub.category === category) && (!query.trim() || `${sub.title} ${sub.description ?? ""} ${sub.category ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const loading = authLoading || (isLoggedIn && (status === "loading" || status === "idle"));
  return <ServiceInnerLayout title="Academic subscriptions" description="Access the library's academic databases and research platforms with your student or employee credentials.">
    {loading ? <div className="service-loading" role="status" aria-label="Loading databases">{[0, 1, 2].map(id => <Skeleton key={id} className="h-32 w-full" />)}</div> : !isLoggedIn ?
      <div className="service-notice"><p>Sign in to view the library's academic database subscriptions and access links.</p><Link to={loginDestination("/services/subscriptions")} className="service-button">Sign in to access</Link></div> : status === "error" ?
      <div className="service-error" role="alert"><p>{error}</p><button className="service-link" onClick={() => void refetch()}>Try again</button></div> : <>
        <div className="subscription-summary"><span>{subscriptions.length} active database{subscriptions.length === 1 ? "" : "s"}</span>{query.trim() || category ? <span>{filtered.length} matching</span> : null}</div>
        {subscriptions.length > 3 && <>
          <label className="service-search"><span className="sr-only">Search databases</span><Search aria-hidden="true" /><input type="search" placeholder="Search databases" value={query} onChange={event => setQuery(event.target.value)} /></label>
          {categories.length > 0 && <div className="subscription-filters" role="group" aria-label="Subject"><button aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>{categories.map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>}
        </>}
        {filtered.length > 0 ? <SubscriptionGrid subscriptions={filtered} /> : <div className="service-empty"><p>{subscriptions.length ? "No databases match. Try another subject or search term." : "No subscriptions available."}</p>{subscriptions.length > 0 && <button className="service-link" onClick={() => { setCategory(null); setQuery(""); }}>Clear filters</button>}</div>}
        <div className="service-notice"><p>This list is managed by the library administration and updated as new subscriptions are added.</p></div>
      </>}
  </ServiceInnerLayout>;
}
