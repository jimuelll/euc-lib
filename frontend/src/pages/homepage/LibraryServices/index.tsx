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
      <main className="border-t border-border py-10 sm:py-12">
        <div className="container max-w-5xl space-y-5 px-4 sm:px-6">

          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-200 hover:text-primary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Services
          </Link>

          {/* Ready for pickup banner */}
          {readyCount > 0 && (
            <div className="flex items-start gap-3 border border-success/20 bg-success/5 p-4">
              <BookMarked className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {readyCount} book{readyCount > 1 ? "s are" : " is"} ready for pickup
                </p>
                <p className="text-muted-foreground mt-0.5">
                    Head to the library front desk with your student or employee ID.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="border border-destructive/20 border-l-[3px] border-l-destructive bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4 border-b border-border pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/20 bg-primary text-primary-foreground">
              <BookMarked className="h-4 w-4" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>
                Library Services
              </p>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Book Reservations
              </h1>
              <p className="text-sm text-muted-foreground">
                Reserve a book — pick it up at the front desk
              </p>
            </div>
          </div>

          <div className="relative border border-border bg-card">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
            <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              placeholder="Search by title, author, or ISBN..."
              className="h-12 border-0 bg-transparent pl-12 pr-4 shadow-none focus-visible:ring-inset"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs defaultValue="reserve">
            <TabsList className="h-auto w-full justify-start gap-0 rounded-none border border-border bg-card p-0 text-muted-foreground sm:w-auto">
              <TabsTrigger value="reserve" className="h-11 rounded-none border-r border-border px-4 text-[11px] font-bold uppercase tracking-[0.13em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                <BookMarked className="h-3.5 w-3.5 mr-1.5" />
                Reserve
                {pendingCount > 0 && (
                  <span className="ml-1.5 bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-current">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="h-11 rounded-none px-4 text-[11px] font-bold uppercase tracking-[0.13em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reserve" className="mt-5">
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

            <TabsContent value="history" className="mt-5">
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
