import { useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  History,
  LayoutDashboard,
  QrCode,
  Search,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { RecommendationStrip } from "@/features/recommendations";
import { useMyLibrary } from "./hooks/useMyLibrary";
import { useMyLibraryActivity } from "./hooks/useMyLibraryActivity";
import { useMyLibraryBarcode } from "./hooks/useMyLibraryBarcode";
import "./my-library.css";
import MyLibraryCurrentPanel from "./components/MyLibraryCurrentPanel";
import MyLibraryHistoryPanel, {
  type HistoryView,
} from "./components/MyLibraryHistoryPanel";
import MyLibraryUpdatesPanel from "./components/MyLibraryUpdatesPanel";
import MyLibraryBarcode from "./components/MyLibraryBarcode";
import {
  EmptyPanel,
  LoadingPanel,
  PanelList,
  RetryNotice,
  SubscriptionItem,
  Surface,
} from "./components/MyLibraryPrimitives";
import { formatCurrency } from "./components/MyLibrary.formatters";

const sections = [
  { value: "overview", label: "Overview", Icon: LayoutDashboard },
  { value: "history", label: "History", Icon: History },
  { value: "updates", label: "Updates", Icon: Bell },
  { value: "discover", label: "Discover", Icon: BookOpen },
] as const;

export default function MyLibrary() {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const view =
    sections.find((section) => section.value === params.get("view"))?.value ??
    "overview";
  const [historyView, setHistoryView] = useState<HistoryView>("transactions");
  const enabled = !authLoading && Boolean(user);
  const { data, loading, error, refreshing, retry } = useMyLibrary(enabled);
  const activity = useMyLibraryActivity({
    historyEnabled:
      enabled && view === "history" && historyView === "transactions",
    attendanceEnabled:
      enabled && view === "history" && historyView === "visits",
  });
  const qr = useMyLibraryBarcode(enabled);
  const {
    notifications,
    unreadCount,
    refresh: refreshNotifications,
    loading: notificationsLoading,
    error: notificationsError,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [qrOpen, setQrOpen] = useState(false);
  const qrTrigger = useRef<HTMLButtonElement | null>(null);
  const openQr = (button: HTMLButtonElement) => {
    qrTrigger.current = button;
    setQrOpen(true);
  };
  const navigateSection = (next: string) => {
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      updated.set("view", next);
      return updated;
    });
  };
  return (
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="my-library-workspace mx-auto max-w-[1440px] px-4 pb-12 pt-8 sm:px-8 sm:pt-10 lg:px-10">
          <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-7">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">
                My Library
              </h1>
              <p className="mt-2 break-words text-sm text-muted-foreground">
                {data?.profile?.name || user?.name || "Your library account"}
                <span className="mx-2 text-border" aria-hidden="true">
                  /
                </span>
                Your loans, reservations, and library activity
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/catalogue">
                  <Search className="size-4" aria-hidden="true" />
                  Browse catalogue
                </Link>
              </Button>
              <Button
                className="min-h-11"
                onClick={(event) => openQr(event.currentTarget)}
              >
                <QrCode className="size-4" aria-hidden="true" />
                Show QR code
              </Button>
            </div>
          </header>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-8">
            <nav
              aria-label="My Library sections"
              className="grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1 lg:sticky lg:top-24 lg:grid-cols-1 lg:gap-1 lg:bg-transparent lg:p-0"
            >
              {sections.map(({ value, label, Icon }) => (
                <Link
                  key={value}
                  to={`?${new URLSearchParams({ ...Object.fromEntries(params), view: value })}`}
                  aria-current={view === value ? "page" : undefined}
                  onClick={(event) => {
                    if (
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey &&
                      !event.altKey &&
                      event.button === 0
                    ) {
                      event.preventDefault();
                      navigateSection(value);
                    }
                  }}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-1 py-3 text-xs font-medium transition-colors sm:text-sm lg:justify-start lg:px-4 ${view === value ? "bg-card text-action lg:bg-primary/5" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="hidden size-4 shrink-0 sm:block"
                  />
                  <span>{label}</span>
                  {value === "updates" && unreadCount > 0 && (
                    <span className="hidden rounded bg-primary px-1.5 py-0.5 text-xs tabular-nums text-primary-foreground sm:inline">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  {value === "updates" && unreadCount > 0 && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-action sm:hidden"
                      aria-label={`${unreadCount} unread updates`}
                    />
                  )}
                </Link>
              ))}
            </nav>
            <div className="min-w-0 space-y-5">
              {error && (
                <RetryNotice
                  message={
                    data
                      ? "Your account could not be refreshed. Previously loaded information is shown."
                      : error
                  }
                  onRetry={() => void retry()}
                  retrying={refreshing}
                />
              )}
              {view === "overview" && (
                <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_248px]">
                  {data ? (
                    <MyLibraryCurrentPanel data={data} />
                  ) : loading || authLoading ? (
                    <LoadingPanel />
                  ) : null}
                  {data ? (
                    <aside
                      aria-label="Library account"
                      className="rounded-xl border border-border bg-card"
                    >
                      <div className="p-5">
                        <h2 className="text-base font-semibold">
                          Your library card
                        </h2>
                        <p className="mt-3 break-words text-sm font-medium">
                          {data.profile?.name || user?.name}
                        </p>
                        <p className="mt-1 break-all text-sm text-muted-foreground">
                          {data.profile?.student_employee_id ||
                            "ID unavailable"}
                        </p>
                        {data.profile?.role && (
                          <p className="mt-1 text-sm capitalize text-muted-foreground">
                            {data.profile.role.replace(/_/g, " ")}
                          </p>
                        )}
                        <div className="mt-5">
                          <MyLibraryBarcode qr={qr} />
                        </div>
                        <Button
                          variant="outline"
                          className="mt-4 min-h-11 w-full"
                          onClick={(event) => openQr(event.currentTarget)}
                        >
                          <QrCode aria-hidden="true" className="size-4" />
                          Open QR code
                        </Button>
                      </div>
                      <div className="border-t border-border p-5">
                        <h3 className="text-sm font-medium">Fines due</h3>
                        <p
                          className={`mt-2 text-xl font-semibold tabular-nums ${data.summary.total_fines_due > 0 ? "text-destructive" : "text-foreground"}`}
                        >
                          {data.summary.total_fines_due > 0
                            ? formatCurrency(data.summary.total_fines_due)
                            : "No fines due"}
                        </p>
                        {data.summary.total_fines_due > 0 && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Visit the circulation desk to discuss your fines.
                          </p>
                        )}
                        <Link
                          to="/edit-profile"
                          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action underline-offset-4 hover:underline"
                        >
                          Edit profile
                        </Link>
                      </div>
                    </aside>
                  ) : (
                    (loading || authLoading) && (
                      <LoadingPanel label="Loading library account" rows={1} />
                    )
                  )}
                </div>
              )}
              {view === "history" && (
                <MyLibraryHistoryPanel
                  view={historyView}
                  onView={setHistoryView}
                  activity={activity}
                />
              )}
              {view === "updates" && (
                <MyLibraryUpdatesPanel
                  notifications={notifications}
                  unreadCount={unreadCount}
                  markAsRead={markAsRead}
                  markAllAsRead={markAllAsRead}
                  state={{
                    loading: notificationsLoading,
                    refreshing: notificationsLoading,
                    error: notificationsError,
                    retry: refreshNotifications,
                  }}
                />
              )}
              {view === "discover" && (
                <div className="my-library-discover space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Discover</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Explore books, research, and digital resources.
                    </p>
                  </div>
                  <RecommendationStrip personal materialType="book" />
                  <RecommendationStrip personal materialType="thesis" />
                  {data ? (
                    <Surface
                      title="Digital resources"
                      actions={
                        <Link
                          to="/services/subscriptions"
                          className="inline-flex min-h-11 items-center text-sm font-medium text-action underline-offset-4 hover:underline"
                        >
                          View all resources
                        </Link>
                      }
                    >
                      {data.subscriptions.length ? (
                        <PanelList>
                          {data.subscriptions.map((subscription) => (
                            <SubscriptionItem
                              key={subscription.id}
                              subscription={subscription}
                            />
                          ))}
                        </PanelList>
                      ) : (
                        <EmptyPanel
                          message="Academic subscriptions will appear here when available. You can also check the full resource list."
                          to="/services/subscriptions"
                          action="View resources"
                        />
                      )}
                    </Surface>
                  ) : (
                    (loading || authLoading) && (
                      <LoadingPanel
                        label="Loading digital resources"
                        rows={1}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
      <DialogContent
        hideClose
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          qrTrigger.current?.focus();
        }}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl"
      >
        <DialogHeader>
          <DialogTitle>Your library QR code</DialogTitle>
          <DialogDescription className="pt-2 leading-6">
            Show this code to library staff to look up your account. Save a copy
            to your phone for quick access.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <MyLibraryBarcode qr={qr} large />
        </div>
        <DialogClose asChild>
          <Button variant="outline" className="min-h-11">
            <X className="size-4" aria-hidden="true" />
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
