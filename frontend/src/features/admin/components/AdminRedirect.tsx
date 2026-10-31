import { Navigate, useLocation } from "react-router-dom";

// Preserve filters, tabs and record links from older bookmarks, logs and notification links.
export default function AdminRedirect({ to }: { to: string }) {
  const { search, hash, state } = useLocation();
  const [pathname, fixed] = to.split("?");
  // Keep the original query text untouched so encoded values survive unchanged.
  const query = [fixed, search.replace(/^\?/, "")].filter(Boolean).join("&");
  return <Navigate to={{ pathname, search: query ? `?${query}` : "", hash }} state={state} replace />;
}
