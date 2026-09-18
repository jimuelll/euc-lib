import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  EmptyPanel,
  PanelList,
  SnapshotRow,
  Surface,
} from "./MyLibraryPrimitives";
import {
  borrowStatusConfig,
  reservationStatusConfig,
  dueLabel,
  formatCurrency,
  formatDate,
} from "./MyLibrary.formatters";
import type { MyLibraryDashboard } from "../types";

type Props = {
  data: MyLibraryDashboard | null;
  summary: MyLibraryDashboard["summary"] | undefined;
  unreadCount: number;
};

const MyLibraryCurrentPanel = ({ data, summary, unreadCount }: Props) => (
                <TabsContent value="current" className="mt-0 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
                  <Surface title="Borrowed Books">
                    {data?.active_borrows.length ? (
                      <PanelList>
                        {data.active_borrows.map((book) => (
                          <div key={book.id} className="flex gap-0">
                            <div className={`w-[3px] shrink-0 ${book.status === "overdue" ? "bg-destructive/60" : "bg-info/50"}`} />
                            <div className="flex-1 px-5 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-[13px] font-bold text-foreground"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                  >
                                    {book.title}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {book.author || "Unknown author"}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold uppercase tracking-[0.08em] ${borrowStatusConfig[book.status].className}`}
                                  style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                                >
                                  {borrowStatusConfig[book.status].label}
                                </Badge>
                              </div>

                              <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                                <span>Due {formatDate(book.due_date, "MMM d, yyyy h:mm a")}</span>
                                <span>{dueLabel(book.due_date)}</span>
                                <span>Borrowed {formatDate(book.borrowed_at, "MMM d, yyyy h:mm a")}</span>
                                {book.status === "overdue" ? (
                                  <span className="font-medium text-destructive">
                                    Fine {formatCurrency(book.fine_amount)}
                                  </span>
                                ) : (
                                  <span>{book.location || "Library circulation desk"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="No active borrowed books right now." />
                    )}
                  </Surface>

                  <div className="space-y-5">
                    <Surface title="Reservations">
                      {data?.active_reservations.length ? (
                        <PanelList>
                          {data.active_reservations.map((reservation) => (
                            <div key={reservation.id} className="flex gap-0">
                              <div className={`w-[3px] shrink-0 ${reservation.status === "ready" ? "bg-success/60" : "bg-info/50"}`} />
                              <div className="flex-1 px-5 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p
                                      className="truncate text-[13px] font-bold text-foreground"
                                      style={{ fontFamily: "var(--font-heading)" }}
                                    >
                                      {reservation.title}
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {reservation.author || "Unknown author"}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold uppercase tracking-[0.08em] ${reservationStatusConfig[reservation.status].className}`}
                                    style={{ fontFamily: "var(--font-heading)", borderRadius: 0 }}
                                  >
                                    {reservationStatusConfig[reservation.status].label}
                                  </Badge>
                                </div>

                                <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
                                  <span>Reserved {formatDate(reservation.reserved_at)}</span>
                                  {reservation.expires_at ? (
                                    <span>Pickup by {formatDate(reservation.expires_at, "MMM d, yyyy h:mm a")}</span>
                                  ) : null}
                                  <span>{reservation.location || "Main circulation desk"}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </PanelList>
                      ) : (
                        <EmptyPanel message="No active reservations at the moment." />
                      )}
                    </Surface>

                    <Surface title="At a Glance">
                      <div className="grid gap-0 divide-y divide-border/70">
                        <SnapshotRow label="Due soon" value={`${summary?.due_soon_borrows ?? 0} items`} />
                        <SnapshotRow label="Unread updates" value={`${unreadCount} notices`} />
                        <SnapshotRow label="Digital access" value={`${data?.subscriptions.length ?? 0} resources`} />
                      </div>
                    </Surface>
                  </div>
                </TabsContent>

);

export default MyLibraryCurrentPanel;

