import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "@/components/ui/library-glyphs";
import ServiceInnerLayout from "@/components/layout/ServiceInnerLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";
import ReserveTab from "./tabs/ReserveTab";
import HistoryTab from "./tabs/HistoryTab";
import type { ActiveReservation } from "./types";
import { fetchActiveReservations, fetchReservationHistory, searchReservationCatalogue, RESERVATION_CATALOGUE_PAGE_SIZE } from "./api";
import { borrowingKeys } from "./borrowing.keys";

export default function LibraryServices() {
  const { loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const debouncedSearch = useDebounce(search, 400);
  useEffect(() => setCatalogPage(1), [debouncedSearch]);
  const activeQuery = useQuery({ queryKey: borrowingKeys.active(), queryFn: ({ signal }) => fetchActiveReservations(signal), enabled: !authLoading });
  const historyQuery = useQuery({ queryKey: borrowingKeys.historyPage(historyPageNumber), queryFn: ({ signal }) => fetchReservationHistory(historyPageNumber, signal), enabled: !authLoading, placeholderData: previous => previous });
  const catalogQuery = useQuery({ queryKey: borrowingKeys.catalogSearch(debouncedSearch, catalogPage), queryFn: ({ signal }) => searchReservationCatalogue(debouncedSearch, catalogPage, signal), enabled: !authLoading, placeholderData: previous => previous });
  const activeReservations = activeQuery.data ?? [];
  const paginationFallback = { page: 1, limit: 20, total: 0, totalPages: 0 };
  const readyCount = activeReservations.filter(res => res.status === "ready").length;
  const handleReserveSuccess = (reservation: ActiveReservation) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), current => [reservation, ...(current ?? [])]);
    void invalidateServerState(queryClient, "reservation");
  };
  const handleCancelSuccess = (id: number) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), current => current?.filter(res => res.id !== id) ?? []);
    void invalidateServerState(queryClient, "reservation");
  };
  return <ServiceInnerLayout title="Book reservations" description="Browse books below or search the collection, then reserve a book for pickup at the library front desk.">
    {readyCount > 0 && <div className="reservation-ready" role="status"><b>{readyCount} book{readyCount > 1 ? "s are" : " is"} ready for pickup.</b> Head to the library front desk with your student or employee ID.</div>}
    <Tabs defaultValue="reserve">
      <TabsList className="reservation-tabs" aria-label="Reservation view"><TabsTrigger value="reserve">Reserve <b>{activeReservations.length}</b></TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      <TabsContent value="reserve" className="reservation-tab-panel">
        <ReserveTab catalog={catalogQuery.data?.rows ?? []} activeReservations={activeReservations} catalogLoading={catalogQuery.isPending} dataLoading={activeQuery.isPending} hasSearched={!!debouncedSearch.trim()}
          catalogError={catalogQuery.isError ? getApiErrorMessage(catalogQuery.error, "Catalogue search failed") : null} activeError={activeQuery.isError ? getApiErrorMessage(activeQuery.error, "Failed to load your reservations") : null}
          onRetryCatalog={() => void catalogQuery.refetch()} onRetryActive={() => void activeQuery.refetch()}
          pagination={catalogQuery.data?.pagination ?? { ...paginationFallback, limit: RESERVATION_CATALOGUE_PAGE_SIZE }} onPageChange={setCatalogPage} onReserveSuccess={handleReserveSuccess} onCancelSuccess={handleCancelSuccess}
          searchField={<label className="service-search"><span className="sr-only">Search the catalogue (optional)</span><Search aria-hidden="true" /><input type="search" placeholder="Search by title, author, or ISBN (optional)…" value={search} onChange={event => setSearch(event.target.value)} /></label>} />
      </TabsContent>
      <TabsContent value="history" className="reservation-tab-panel">
        {historyQuery.isError ? <div className="service-error" role="alert"><p>{getApiErrorMessage(historyQuery.error, "Failed to load reservation history")}</p><button className="service-link" onClick={() => void historyQuery.refetch()}>Try again</button></div> : <HistoryTab history={historyQuery.data?.rows ?? []} loading={historyQuery.isPending} pagination={historyQuery.data?.pagination ?? paginationFallback} onPageChange={setHistoryPageNumber} />}
      </TabsContent>
    </Tabs>
  </ServiceInnerLayout>;
}
