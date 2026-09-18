import { TabsContent } from "@/components/ui/tabs";
import {
  AttendanceRow,
  EmptyPanel,
  HistoryItem,
  PanelList,
  Surface,
} from "./MyLibraryPrimitives";
import { formatDate } from "./MyLibrary.formatters";
import type { MyLibraryDashboard, MyLibraryPage, MyLibraryHistoryItem, AttendanceSession } from "../types";

type Props = {
  data: MyLibraryDashboard | null;
  historyLoading: boolean;
  historyPage: MyLibraryPage<MyLibraryHistoryItem> | null;
  attendanceLoading: boolean;
  attendancePage: MyLibraryPage<AttendanceSession> | null;
  activityCount: number;
  loadHistory: (page?: number) => Promise<void>;
  loadAttendance: (page?: number) => Promise<void>;
};

const MyLibraryHistoryPanel = ({ data, historyLoading, historyPage, attendanceLoading, attendancePage, activityCount, loadHistory, loadAttendance }: Props) => (
                <TabsContent value="history" className="mt-0 grid gap-5 lg:grid-cols-2">
                  <Surface title="Recent Activity">
                    {historyLoading ? <div className="space-y-3 px-5 py-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse bg-muted/60" />)}</div> : activityCount ? (
                      <PanelList>
                        {historyPage?.rows.map((item) => (
                          <HistoryItem
                            key={`${item.kind}-${item.id}`}
                            title={item.title}
                            subtitle={item.author || "Unknown author"}
                            meta={item.kind === "borrowing" ? `Returned ${formatDate(item.returned_at)}` : `${item.status[0].toUpperCase()}${item.status.slice(1)} | ${formatDate(item.reserved_at)}`}
                            badgeLabel={item.kind === "borrowing" ? "Borrowing" : "Reservation"}
                          />
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="Your recent borrowing and reservation history will appear here." />
                    )}
                    {!historyLoading && (historyPage?.pagination.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between border-t border-border/70 px-5 py-3"><span className="text-xs text-muted-foreground">Page {historyPage?.pagination.page} of {historyPage?.pagination.totalPages}</span><div className="flex gap-2"><button type="button" className="text-xs text-primary disabled:opacity-40" disabled={historyPage?.pagination.page === 1} onClick={() => void loadHistory((historyPage?.pagination.page ?? 1) - 1)}>Previous</button><button type="button" className="text-xs text-primary disabled:opacity-40" disabled={historyPage?.pagination.page === historyPage?.pagination.totalPages} onClick={() => void loadHistory((historyPage?.pagination.page ?? 1) + 1)}>Next</button></div></div> : null}
                  </Surface>

                  <Surface title="Attendance History">
                    {attendanceLoading ? <div className="space-y-3 px-5 py-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 animate-pulse bg-muted/60" />)}</div> : (attendancePage?.rows ?? data?.attendance_sessions ?? []).length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/70 bg-muted/20">
                              {["Date", "Time In", "Time Out"].map((heading) => (
                                <th
                                  key={heading}
                                  className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
                                  style={{ fontFamily: "var(--font-heading)" }}
                                >
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/70">
                            {(attendancePage?.rows ?? data?.attendance_sessions ?? []).map((session, index) => (
                              <AttendanceRow key={`${session.date ?? "attendance"}-${index}`} session={session} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyPanel message="No attendance logs found yet." />
                    )}
                    {!attendanceLoading && (attendancePage?.pagination.totalPages ?? 0) > 1 ? <div className="flex items-center justify-between border-t border-border/70 px-5 py-3"><span className="text-xs text-muted-foreground">Page {attendancePage?.pagination.page} of {attendancePage?.pagination.totalPages}</span><div className="flex gap-2"><button type="button" className="text-xs text-primary disabled:opacity-40" disabled={attendancePage?.pagination.page === 1} onClick={() => void loadAttendance((attendancePage?.pagination.page ?? 1) - 1)}>Previous</button><button type="button" className="text-xs text-primary disabled:opacity-40" disabled={attendancePage?.pagination.page === attendancePage?.pagination.totalPages} onClick={() => void loadAttendance((attendancePage?.pagination.page ?? 1) + 1)}>Next</button></div></div> : null}
                  </Surface>
                </TabsContent>

);

export default MyLibraryHistoryPanel;


