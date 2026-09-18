import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function TermRevalidationNotice() {
  const { user, loading } = useAuth();
  if (loading || user?.term_status !== "expired") return null;
  return <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl border border-warning/45 bg-card px-4 py-3 shadow-lg sm:inset-x-auto sm:right-5"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /><div><p className="font-semibold text-foreground">Library card revalidation required</p><p className="mt-1 text-sm text-muted-foreground">Your academic term has expired. You can still sign in and view your account; please visit the library desk to revalidate your card.</p><Link to="/my-library" className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4">View my library account</Link></div></div></div>;
}
