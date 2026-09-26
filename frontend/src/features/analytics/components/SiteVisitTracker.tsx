import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { recordSiteVisit } from "../api/visitor.api";
import { useAuth } from "@/context/AuthContext";
import { invalidateServerState } from "@/app/server-state";

const todayKey = () => new Date().toISOString().slice(0, 10);

const SiteVisitTracker = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { mutateAsync: recordVisitMutation } = useMutation({
    mutationFn: recordSiteVisit,
    onSuccess: () => invalidateServerState(queryClient, "analytics"),
  });

  useEffect(() => {
    if (loading) return;

    const visitorState = user ? "auth" : "guest";
    const storageKey = `site-visit:${todayKey()}:${visitorState}`;

    if (sessionStorage.getItem(storageKey)) return;

    let cancelled = false;

    recordVisitMutation(location.pathname)
      .then(() => {
        if (!cancelled) {
          sessionStorage.setItem(storageKey, "1");
        }
      })
      .catch(() => {
        // Visit tracking should never interrupt page use.
      });

    return () => {
      cancelled = true;
    };
  }, [loading, location.pathname, user, recordVisitMutation]);

  return null;
};

export default SiteVisitTracker;
