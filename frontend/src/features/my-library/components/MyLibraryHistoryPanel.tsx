import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyPanel,
  LoadingPanel,
  Pagination,
  PanelList,
  RetryNotice,
  Surface,
} from "./MyLibraryPrimitives";
import { formatDate } from "./MyLibrary.formatters";
import type { useMyLibraryActivity } from "../hooks/useMyLibraryActivity";
import MyLibraryCover from "./MyLibraryCover";

export type HistoryView = "transactions" | "visits";
type Props = {
  view: HistoryView;
  onView: (view: HistoryView) => void;
  activity: ReturnType<typeof useMyLibraryActivity>;
};

export default function MyLibraryHistoryPanel({
  view,
  onView,
  activity,
}: Props) {
  const visits = view === "visits";
  const loading = visits ? activity.attendanceLoading : activity.historyLoading;
  const refreshing = visits
    ? activity.attendanceRefreshing
    : activity.historyRefreshing;
  const error = visits ? activity.attendanceError : activity.historyError;
  const page = visits ? activity.attendancePage : activity.historyPage;
  const load = visits ? activity.loadAttendance : activity.loadHistory;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">History</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your past loans, reservations, and time in the library.
        </p>
      </div>
      <Tabs value={view} onValueChange={(next) => onView(next as HistoryView)}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger
            value="transactions"
            className="min-h-11 px-3 text-sm data-[state=active]:shadow-none"
          >
            Loans & reservations
          </TabsTrigger>
          <TabsTrigger
            value="visits"
            className="min-h-11 px-3 text-sm data-[state=active]:shadow-none"
          >
            Library visits
          </TabsTrigger>
        </TabsList>
        <TabsContent value={view} className="mt-5 space-y-4">
          {error && (
            <RetryNotice
              message={
                page
                  ? "Your history could not be refreshed. Previously loaded records are shown."
                  : error
              }
              onRetry={() => void load(page?.pagination.page ?? 1)}
              retrying={refreshing}
            />
          )}
          {loading ? (
            <LoadingPanel
              label={visits ? "Loading library visits" : "Loading loan history"}
            />
          ) : (
            page && (
              <Surface
                title={visits ? "Library visits" : "Loans & reservations"}
                count={page.pagination.total}
                actions={
                  refreshing ? (
                    <span
                      role="status"
                      className="text-sm text-muted-foreground"
                    >
                      Updating…
                    </span>
                  ) : undefined
                }
              >
                {visits ? (
                  activity.attendancePage?.rows.length ? (
                    <div className="divide-y divide-border">
                      {activity.attendancePage.rows.map((session, index) => (
                        <div
                          key={`${session.date}-${index}`}
                          className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6"
                        >
                          <p className="text-sm font-semibold">
                            {formatDate(session.date)}
                          </p>
                          <div className="text-sm">
                            <p className="text-muted-foreground">Time in</p>
                            <p className="mt-1 tabular-nums">
                              {formatDate(session.time_in, "h:mm a")}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="text-muted-foreground">Time out</p>
                            <p className="mt-1 tabular-nums">
                              {formatDate(session.time_out, "h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel message="Your library check-ins and check-outs will appear here after a recorded visit." />
                  )
                ) : activity.historyPage?.rows.length ? (
                  <PanelList>
                    {activity.historyPage.rows.map((item) => (
                      <article
                        key={`${item.kind}-${item.id}`}
                        className="min-w-0 px-5 py-5 sm:px-6"
                      >
                        <div className="flex items-start gap-4">
                          <MyLibraryCover {...item} />
                          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 basis-48">
                              <h3 className="break-words text-base font-semibold">
                                {item.title}
                              </h3>
                              <p className="mt-1 break-words text-sm text-muted-foreground">
                                {item.author || "Unknown author"}
                              </p>
                            </div>
                            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                              {item.status}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {item.kind === "borrowing" ? "Loan" : "Reservation"} ·{" "}
                          {formatDate(item.occurred_at)}
                        </p>
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          {item.borrowed_at && (
                            <div>
                              <dt className="inline">Borrowed: </dt>
                              <dd className="inline">
                                {formatDate(item.borrowed_at)}
                              </dd>
                            </div>
                          )}
                          {item.returned_at && (
                            <div>
                              <dt className="inline">Returned: </dt>
                              <dd className="inline">
                                {formatDate(item.returned_at)}
                              </dd>
                            </div>
                          )}
                          {item.reserved_at && (
                            <div>
                              <dt className="inline">Reserved: </dt>
                              <dd className="inline">
                                {formatDate(item.reserved_at)}
                              </dd>
                            </div>
                          )}
                          {(item.copy_barcode || item.copy_id) && (
                            <div className="break-all">
                              <dt className="inline">Copy: </dt>
                              <dd className="inline">
                                {item.copy_barcode || item.copy_id}
                              </dd>
                            </div>
                          )}
                          {item.accession_number && (
                            <div className="break-all">
                              <dt className="inline">Accession: </dt>
                              <dd className="inline">
                                {item.accession_number}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </article>
                    ))}
                  </PanelList>
                ) : (
                  <EmptyPanel message="Completed loans and reservations will appear here. Your current items are in Overview." />
                )}
                <Pagination
                  page={page.pagination.page}
                  totalPages={page.pagination.totalPages}
                  busy={refreshing}
                  onPage={(next) => void load(next)}
                />
              </Surface>
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
