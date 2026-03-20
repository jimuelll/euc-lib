import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { BookMarked, RotateCcw, Search, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axiosInstance from "@/utils/AxiosInstance";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/context/AuthContext";
import ReserveTab from "./tabs/ReserveTab";
import HistoryTab from "./tabs/HistoryTab";

import type { CatalogBook, ActiveReservation, ReservationHistory } from "./types";

const LibraryServices = () => {
  const { loading: authLoading } = useAuth();
  const [search, setSearch]                         = useState("");
  const [catalog, setCatalog]                       = useState<CatalogBook[]>([]);
  const [activeReservations, setActiveReservations] = useState<ActiveReservation[]>([]);
  const [history, setHistory]                       = useState<ReservationHistory[]>([]);
  const [catalogLoading, setCatalogLoading]         = useState(false);
  const [dataLoading, setDataLoading]               = useState(true);
  const [error, setError]                           = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  // Wait for auth to restore token before fetching
  useEffect(() => {
    if (authLoading) return;
    const fetchUserData = async () => {
      setDataLoading(true);
      try {
        const [activeRes, historyRes] = await Promise.all([
          axiosInstance.get("api/reservations/active"),
          axiosInstance.get("api/reservations/history"),
        ]);
        setActiveReservations(activeRes.data);
        setHistory(historyRes.data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? "Failed to load your reservations");
      } finally {
        setDataLoading(false);
      }
    };
    fetchUserData();
  }, [authLoading]);

  // Catalogue search — also gated on auth being ready
  const fetchCatalogue = useCallback(async (q: string) => {
    if (!q.trim() || authLoading) { setCatalog([]); return; }
    setCatalogLoading(true);
    try {
      const res = await axiosInstance.get("api/reservations/catalogue/search", {
        params: { query: q.trim() },
      });
      setCatalog(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Catalogue search failed");
    } finally {
      setCatalogLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    fetchCatalogue(debouncedSearch);
  }, [debouncedSearch, fetchCatalogue]);

  const handleReserveSuccess = useCallback(
    (newReservation: ActiveReservation, bookId: number) => {
      setActiveReservations((prev) => [newReservation, ...prev]);
    },
    []
  );

  const handleCancelSuccess = useCallback((reservationId: number) => {
    setActiveReservations((prev) => prev.filter((r) => r.id !== reservationId));
  }, []);

  const pendingCount = activeReservations.filter((r) => r.status === "pending").length;
  const readyCount   = activeReservations.filter((r) => r.status === "ready").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16">
        <div className="container max-w-4xl space-y-6">

          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Services
          </Link>

          {/* Ready for pickup banner */}
          {readyCount > 0 && (
            <div className="rounded-lg border border-success/20 bg-success/5 p-4 flex items-start gap-3">
              <BookMarked className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {readyCount} book{readyCount > 1 ? "s are" : " is"} ready for pickup
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Head to the library front desk with your student ID.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <BookMarked className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Book Reservations
              </h1>
              <p className="text-sm text-muted-foreground">
                Reserve a book — pick it up at the front desk
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or ISBN..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs defaultValue="reserve">
            <TabsList>
              <TabsTrigger value="reserve">
                <BookMarked className="h-3.5 w-3.5 mr-1.5" />
                Reserve
                {pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reserve" className="mt-4">
              <ReserveTab
                catalog={catalog}
                activeReservations={activeReservations}
                catalogLoading={catalogLoading}
                dataLoading={dataLoading}
                hasSearched={!!debouncedSearch.trim()}
                onReserveSuccess={handleReserveSuccess}
                onCancelSuccess={handleCancelSuccess}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <HistoryTab history={history} loading={dataLoading} />
            </TabsContent>
          </Tabs>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LibraryServices;