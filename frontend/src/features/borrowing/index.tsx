import { useSearchParams } from "react-router-dom";
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
  const [params, setParams] = useSearchParams();
  const rawBookId = params.get("bookId");
  const selected = rawBookId !== null;
  const bookId = rawBookId && /^[1-9]\d*$/.test(rawBookId) && Number.isSafeInteger(Number(rawBookId)) ? Number(rawBookId) : undefined;
  const invalidSelection = selected && bookId === undefined;
  const clearSelection = () => { setParams(current => { const next = new URLSearchParams(current); next.delete("bookId"); return next; }); setCatalogPage(1); setSearch(""); };
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("reserve");
  useEffect(() => { if (rawBookId !== null) setTab("reserve"); }, [rawBookId]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const debouncedSearch = useDebounce(search, 400);
  useEffect(() => setCatalogPage(1), [debouncedSearch]);
  const activeQuery = useQuery({ queryKey: borrowingKeys.active(), queryFn: ({ signal }) => fetchActiveReservations(signal), enabled: !authLoading });
  const historyQuery = useQuery({ queryKey: borrowingKeys.historyPage(historyPageNumber), queryFn: ({ signal }) => fetchReservationHistory(historyPageNumber, signal), enabled: !authLoading, placeholderData: previous => previous });
  const catalogQuery = useQuery({ queryKey: borrowingKeys.catalogSearch(selected ? "" : debouncedSearch, selected ? 1 : catalogPage, bookId), queryFn: ({ signal }) => searchReservationCatalogue(selected ? "" : debouncedSearch, selected ? 1 : catalogPage, signal, bookId), enabled: !authLoading && !invalidSelection });
  const activeReservations = activeQuery.data ?? [];
  const paginationFallback = { page: 1, limit: 20, total: 0, totalPages: 0 };
  // Keep the selected-book view exact even if a cached or older API returns a browse page.
  const catalogueRows = catalogQuery.data?.rows ?? [];
  const visibleCatalogue = selected ? catalogueRows.filter(book => Number(book.id) === bookId) : catalogueRows;
  const cataloguePagination = selected
    ? { page: 1, limit: RESERVATION_CATALOGUE_PAGE_SIZE, total: visibleCatalogue.length, totalPages: visibleCatalogue.length ? 1 : 0 }
    : catalogQuery.data?.pagination ?? { ...paginationFallback, limit: RESERVATION_CATALOGUE_PAGE_SIZE };
  const readyCount = activeReservations.filter(res => res.status === "ready").length;
  const handleReserveSuccess = (reservation: ActiveReservation) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), current => [reservation, ...(current ?? [])]);
    void invalidateServerState(queryClient, "reservation");
  };
  const handleCancelSuccess = (id: number) => {
    queryClient.setQueryData<ActiveReservation[]>(borrowingKeys.active(), current => current?.filter(res => res.id !== id) ?? []);
    void invalidateServerState(queryClient, "reservation");
  };
  return <ServiceInnerLayout title="Book reservations" description={selected ? "Your selected title is shown below. Reserve it to request pickup, then wait for a Ready notification before visiting the library." : "Browse books below or search the collection, then reserve a book for pickup at the library front desk."}>
    {readyCount > 0 && <div className="reservation-ready" role="status"><b>{readyCount} book{readyCount > 1 ? "s are" : " is"} ready for pickup.</b> Head to the library front desk with your student or employee ID.</div>}
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="reservation-tabs" aria-label="Reservation view"><TabsTrigger value="reserve">Reserve</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      <TabsContent value="reserve" className="reservation-tab-panel">
        <ReserveTab selected={selected} onClearSelection={clearSelection} catalog={visibleCatalogue} activeReservations={activeReservations} catalogLoading={!invalidSelection && (catalogQuery.isPending || (!selected && search !== debouncedSearch))} dataLoading={activeQuery.isPending} hasSearched={selected || !!search.trim()}
          catalogError={invalidSelection ? "This book selection is invalid. Browse all books to choose another title." : catalogQuery.isError ? getApiErrorMessage(catalogQuery.error, "Catalogue search failed") : null} activeError={activeQuery.isError ? getApiErrorMessage(activeQuery.error, "Failed to load your reservations") : null}
          onRetryCatalog={invalidSelection ? undefined : () => void catalogQuery.refetch()} onRetryActive={() => void activeQuery.refetch()}
          pagination={cataloguePagination} onPageChange={setCatalogPage} onReserveSuccess={handleReserveSuccess} onCancelSuccess={handleCancelSuccess}
          searchField={<label className="service-search"><span className="sr-only">Search the catalogue (optional)</span><Search aria-hidden="true" /><input type="search" placeholder="Search by title, author, or ISBN (optional)…" value={selected ? visibleCatalogue[0]?.title ?? "" : search} onChange={event => { if (selected) clearSelection(); setSearch(event.target.value); }} /></label>} />
      </TabsContent>
      <TabsContent value="history" className="reservation-tab-panel">
        {historyQuery.isError ? <div className="service-error" role="alert"><p>{getApiErrorMessage(historyQuery.error, "Failed to load reservation history")}</p><button className="service-link" onClick={() => void historyQuery.refetch()}>Try again</button></div> : <HistoryTab history={historyQuery.data?.rows ?? []} loading={historyQuery.isPending} pagination={historyQuery.data?.pagination ?? paginationFallback} onPageChange={setHistoryPageNumber} />}
      </TabsContent>
    </Tabs>
  </ServiceInnerLayout>;
}
