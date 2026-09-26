import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookMarked, RotateCcw, Search, ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicPageMasthead from "@/components/layout/PublicPageMasthead";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";
import ReserveTab from "./tabs/ReserveTab";
import HistoryTab from "./tabs/HistoryTab";

import type { ActiveReservation } from "./types";
import { fetchActiveReservations, fetchReservationHistory, searchReservationCatalogue, type ReservationPagination } from "./api";
import { borrowingKeys } from "./borrowing.keys";

type Pagination = ReservationPagination;

const LibraryServices = () => {
  const { loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch]                         = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [historyPageNumber, setHistoryPageNumber] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => setCatalogPage(1), [debouncedSearch]);
  const activeQuery = useQuery({
    queryKey: borrowingKeys.active(),
    queryFn: ({ signal }) => fetchActiveReservations(signal),
    enabled: !authLoading,
  });
  const historyQuery = useQuery({
    queryKey: borrowingKeys.historyPage(historyPageNumber),
    queryFn: ({ signal }) => fetchReservationHistory(historyPageNumber, signal),
    enabled: !authLoading,
    placeholderData: (previousData) => previousData,
  });
  const catalogQuery = useQuery({
    queryKey: borrowingKeys.catalogSearch(debouncedSearch, catalogPage),
    queryFn: ({ signal }) => searchReservationCatalogue(debouncedSearch, catalogPage, signal),
    enabled: !authLoading && Boolean(debouncedSearch.trim()),
    placeholderData: (previousData) => previousData,
  });
  const activeReservations = activeQuery.data ?? [];
  const history = historyQuery.data?.rows ?? [];
  const catalog = debouncedSearch.trim() ? (catalogQuery.data?.rows ?? []) : [];
  const catalogPagination: Pagination = catalogQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const historyPagination: Pagination = historyQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const catalogLoading = catalogQuery.isPending && Boolean(debouncedSearch.trim());
  const dataLoading = activeQuery.isPending || historyQuery.isPending;
  const error = activeQuery.isError || historyQuery.isError
    ? getApiErrorMessage(activeQuery.error ?? historyQuery.error, "Failed to load your reservations")
    : catalogQuery.isError ? getApiErrorMessage(catalogQuery.error, "Catalogue search failed") : null;

  const handleReserveSuccess = (reservation: ActiveReservation) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), (current) => [reservation, ...(current ?? [])]);
    void invalidateServerState(queryClient, "reservation");
  };
  const handleCancelSuccess = (reservationId: number) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), (current) => current?.filter((reservation) => reservation.id !== reservationId) ?? []);
    void invalidateServerState(queryClient, "reservation");
  };

  const pendingCount = activeReservations.filter((r) => r.status === "pending").length;
  const readyCount   = activeReservations.filter((r) => r.status === "ready").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PublicPageMasthead title="Book Reservations" description="Search the collection and reserve books for pickup at the library front desk." />
      <main className="border-t border-border py-10 sm:py-12">
        <div className="container max-w-5xl space-y-5 px-5 sm:px-8 lg:px-12">

          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-200 hover:text-primary"
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
            <TabsList className="h-auto w-full justify-start gap-0 rounded-md border border-border bg-card p-0 text-muted-foreground sm:w-auto">
              <TabsTrigger value="reserve" className="h-11 rounded-md border-r border-border px-4 text-xs font-bold uppercase tracking-[0.13em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                <BookMarked className="h-3.5 w-3.5 mr-1.5" />
                Reserve
                {pendingCount > 0 && (
                  <span className="ml-1.5 bg-warning/20 px-1.5 py-0.5 text-xs font-bold text-current">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="h-11 rounded-md px-4 text-xs font-bold uppercase tracking-[0.13em] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
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
                pagination={catalogPagination}
                onPageChange={setCatalogPage}
                onReserveSuccess={handleReserveSuccess}
                onCancelSuccess={handleCancelSuccess}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-5">
              <HistoryTab history={history} loading={historyQuery.isFetching} pagination={historyPagination} onPageChange={setHistoryPageNumber} />
            </TabsContent>
          </Tabs>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LibraryServices;
