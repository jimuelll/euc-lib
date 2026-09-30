import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyPanel,
  LoadingPanel,
  PanelList,
  RetryNotice,
  Surface,
} from "./MyLibraryPrimitives";
import { relativeTime } from "./MyLibrary.formatters";
import type { DashboardNotification } from "../types";

type Props = {
  notifications: DashboardNotification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  state: {
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    retry: () => Promise<unknown>;
  };
};
export default function MyLibraryUpdatesPanel({
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  state,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readAll = async () => {
    setPending(true);
    setError(null);
    try {
      await markAllAsRead();
    } catch {
      setError("Updates could not be marked as read. Please try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Notices about your account and the library.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {state.error && (
        <RetryNotice
          message={
            notifications.length
              ? "Updates could not be refreshed. Previously loaded notices are shown."
              : state.error
          }
          onRetry={() => void state.retry()}
          retrying={state.refreshing}
        />
      )}
      {state.loading && !notifications.length ? (
        <LoadingPanel label="Loading updates" />
      ) : (
        (notifications.length > 0 || !state.error) && (
          <Surface
            title="Notifications"
            count={notifications.length}
            actions={
              unreadCount > 0 && notifications.length > 0 ? (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => void readAll()}
                >
                  {pending ? "Marking as read…" : "Mark all as read"}
                </Button>
              ) : undefined
            }
          >
            {notifications.length ? (
              <PanelList>
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    to={notification.href || "/my-library?view=updates"}
                    onClick={() => {
                      if (!notification.is_read)
                        void markAsRead(notification.id).catch(() =>
                          setError(
                            "This update could not be marked as read. Please try again.",
                          ),
                        );
                    }}
                    className="block px-5 py-5 transition-colors hover:bg-muted/40 sm:px-6"
                  >
                    <div className="flex items-start gap-3">
                      {!notification.is_read && (
                        <span
                          className="mt-2 size-2 shrink-0 rounded-full bg-action"
                          aria-label="Unread"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="break-words text-base font-semibold">
                            {notification.title}
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            {relativeTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                          {notification.body}
                        </p>
                      </div>
                      <ArrowUpRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                ))}
              </PanelList>
            ) : (
              <EmptyPanel message="You're all caught up. Library notices and account updates will appear here." />
            )}
          </Surface>
        )
      )}
    </div>
  );
}
