import { Link } from "react-router-dom";
import { CalendarDays, ExternalLink, LibraryBig, Search } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import {
  EmptyPanel,
  PanelList,
  QuickAccessRow,
  SubscriptionItem,
  Surface,
} from "./MyLibraryPrimitives";
import {
  notificationStyles,
  relativeTime,
} from "./MyLibrary.formatters";
import type { MyLibraryDashboard, DashboardNotification } from "../types";

type Props = {
  data: MyLibraryDashboard | null;
  notifications: DashboardNotification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const MyLibraryUpdatesPanel = ({ data, notifications, unreadCount, markAsRead, markAllAsRead }: Props) => (
                <TabsContent value="updates" className="mt-0 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <Surface
                    title="Notifications"
                    actions={
                      notifications.length > 0 && unreadCount > 0 ? (
                        <button
                          onClick={() => void markAllAsRead()}
                          className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Mark all as read
                        </button>
                      ) : null
                    }
                  >
                    {notifications.length ? (
                      <PanelList>
                        {notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            to={notification.href || "/my-library"}
                            className="block"
                            onClick={() => {
                              if (!notification.is_read) {
                                void markAsRead(notification.id);
                              }
                            }}
                          >
                            <div className={`flex gap-0 transition-colors hover:bg-muted/10 ${notification.is_read ? "opacity-75" : ""}`}>
                              <div className={`w-[3px] shrink-0 ${notificationStyles[notification.type] ?? "bg-info/50"}`} />
                              <div className="flex-1 px-5 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <p
                                    className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                  >
                                    {notification.title}
                                  </p>
                                  <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    {relativeTime(notification.created_at)}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {notification.body}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </PanelList>
                    ) : (
                      <EmptyPanel message="No urgent updates right now." />
                    )}
                  </Surface>

                  <div className="space-y-5">
                    <Surface title="Digital Resources">
                      {data?.subscriptions.length ? (
                        <PanelList>
                          {data.subscriptions.slice(0, 4).map((subscription) => (
                            <SubscriptionItem key={subscription.id} subscription={subscription} />
                          ))}
                        </PanelList>
                      ) : (
                        <EmptyPanel message="No academic subscriptions are available yet." />
                      )}

                      {data?.subscriptions.length ? (
                        <div className="border-t border-border/70 px-5 py-4">
                          <Link
                            to="/services/subscriptions"
                            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            View all resources
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ) : null}
                    </Surface>

                    <Surface title="Quick Access">
                      <div className="grid gap-0 divide-y divide-border/70">
                        <QuickAccessRow icon={Search} to="/catalogue" label="Search the catalogue" />
                        <QuickAccessRow icon={CalendarDays} to="/services/borrowing" label="Check reservation options" />
                        <QuickAccessRow icon={LibraryBig} to="/services/subscriptions" label="Open subscription list" />
                      </div>
                    </Surface>
                  </div>
                </TabsContent>
);

export default MyLibraryUpdatesPanel;


