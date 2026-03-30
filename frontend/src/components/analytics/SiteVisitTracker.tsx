import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import axiosInstance from "@/utils/AxiosInstance";
import { useAuth } from "@/context/AuthContext";

const todayKey = () => new Date().toISOString().slice(0, 10);

const SiteVisitTracker = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const visitorState = user ? "auth" : "guest";
    const storageKey = `site-visit:${todayKey()}:${visitorState}`;

    if (sessionStorage.getItem(storageKey)) return;

    let cancelled = false;

    axiosInstance
      .post("/api/analytics/visit", {
        path: location.pathname,
      })
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
  }, [loading, location.pathname, user]);

  return null;
};

export default SiteVisitTracker;
