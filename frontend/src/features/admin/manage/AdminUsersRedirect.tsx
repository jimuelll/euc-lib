import { Navigate, useLocation } from "react-router-dom";

// Preserve reference filters and patron links from older bookmarks and logs.
export default function AdminUsersRedirect() {
  const { search, hash, state } = useLocation();
  return <Navigate to={{ pathname: "/admin/manage", search, hash }} state={state} replace />;
}
