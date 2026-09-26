import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, RefreshCw, Send, User, Users, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "@/features/admin";
import { createAdminNotification, fetchAdminNotifications, searchNotificationRecipients, type AdminNotification, type AdminNotificationStats, type AudienceType, type NotificationRecipient } from "./api";
import { notificationKeys } from "../notifications.keys";
import { getApiErrorMessage } from "@/utils/apiError";
import { invalidateServerState } from "@/app/server-state";

const emptyStats: AdminNotificationStats = {
  total_notifications: 0,
  created_today: 0,
  broadcast_notifications: 0,
  direct_notifications: 0,
};

const defaultForm = {
  type: "announcement",
  title: "",
  body: "",
  href: "",
  audienceType: "all" as AudienceType,
  audienceRole: "student",
  expiresAt: "",
};

const notificationTypeOptions = [
  { value: "announcement", label: "Announcement" },
  { value: "reminder", label: "Reminder" },
  { value: "reservation_ready", label: "Reservation Ready" },
  { value: "reservation_cancelled", label: "Reservation Cancelled" },
  { value: "overdue_fine", label: "Overdue Fine" },
];

const linkOptions = [
  { value: "none", label: "No link" },
  { value: "/my-library", label: "My Library" },
  { value: "/bulletin", label: "Bulletin" },
  { value: "/services/borrowing", label: "Borrowing Services" },
  { value: "/catalogue", label: "Catalogue" },
];

const AdminNotifications = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<NotificationRecipient | null>(null);
  const debouncedRecipientQuery = useDebounce(recipientSearch.trim(), 300);
  const notificationsQuery = useQuery({
    queryKey: notificationKeys.adminList(page),
    queryFn: ({ signal }) => fetchAdminNotifications(page, signal),
    placeholderData: keepPreviousData,
  });
  const recipientQuery = useQuery({
    queryKey: notificationKeys.recipientSearch(debouncedRecipientQuery),
    queryFn: ({ signal }) => searchNotificationRecipients(debouncedRecipientQuery, signal),
    enabled: form.audienceType === "user" && debouncedRecipientQuery.length >= 2 && !selectedRecipient,
  });
  const stats: AdminNotificationStats = notificationsQuery.data?.stats ?? emptyStats;
  const notifications: AdminNotification[] = notificationsQuery.data?.notifications ?? [];
  const pagination = notificationsQuery.data?.pagination ?? { page, limit: 20, total: 0, totalPages: 1 };
  const recipientResults = recipientQuery.data ?? [];
  const loading = notificationsQuery.isFetching;
  const recipientLoading = recipientQuery.isFetching;
  const recipientError = recipientQuery.isError ? getApiErrorMessage(recipientQuery.error, "Could not search accounts. Try again.") : "";
  const createMutation = useMutation({
    mutationFn: createAdminNotification,
    onSuccess: async () => {
      setSuccess("Notification sent successfully.");
      setForm(defaultForm);
      setRecipientSearch("");
      setSelectedRecipient(null);
      setPage(1);
      await invalidateServerState(queryClient, "notifications");
    },
    onError: (failure) => setError(getApiErrorMessage(failure, "Failed to send notification")),
  });

  const audienceHelp = useMemo(() => {
    if (form.audienceType === "user") return "Send this notification to one selected account.";
    if (form.audienceType === "role") return "Send this notification to every user under one role.";
    return "Broadcast this notification to all active users.";
  }, [form.audienceType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      await createMutation.mutateAsync({
        type: form.type.trim() || "announcement",
        title: form.title,
        body: form.body,
        href: form.href || null,
        audienceType: form.audienceType,
        audienceUserId: form.audienceType === "user" ? selectedRecipient?.id ?? null : null,
        audienceRole: form.audienceType === "role" ? form.audienceRole : null,
        expiresAt: form.expiresAt || null,
      });

    } catch { /* Mutation state and the inline error preserve the existing feedback. */ }
  };

  return (
    <AdminPage
      eyebrow="Content Management"
      title="Notifications"
      description="Send real-time notifications to all users, a role, or a single account and review recently sent messages."
      contentWidth="wide"
      actions={
        <Button type="button" variant="outline" onClick={() => void notificationsQuery.refetch()} disabled={loading || createMutation.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <AdminStatGrid>
        <AdminStatCard label="Total Sent" value={loading ? "-" : String(stats.total_notifications)} icon={<BellRing className="h-4 w-4" />} />
        <AdminStatCard label="Sent Today" value={loading ? "-" : String(stats.created_today)} icon={<Waves className="h-4 w-4" />} />
        <AdminStatCard label="Broadcasts" value={loading ? "-" : String(stats.broadcast_notifications)} icon={<Users className="h-4 w-4" />} />
        <AdminStatCard label="Direct" value={loading ? "-" : String(stats.direct_notifications)} icon={<User className="h-4 w-4" />} />
      </AdminStatGrid>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Create notification"
          description="This uses the live admin notification API and pushes to connected users instantly over WebSocket."
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type</label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Audience</label>
                <Select
                  value={form.audienceType}
                  onValueChange={(value: AudienceType) => { setForm((prev) => ({ ...prev, audienceType: value })); setRecipientSearch(""); setSelectedRecipient(null); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="role">By role</SelectItem>
                    <SelectItem value="user">Single user</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Library closed tomorrow"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Message</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="The library will be closed for maintenance."
                className="min-h-[120px]"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Link target</label>
                <Select
                  value={form.href || "none"}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, href: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select link target" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkOptions.map((option) => (
                      <SelectItem key={`${option.label}-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expires at</label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            {form.audienceType === "role" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Role</label>
                <Select
                  value={form.audienceRole}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, audienceRole: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="scanner">Scanner</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {form.audienceType === "user" ? (
              <div className="space-y-2">
                <label htmlFor="notification-recipient-search" className="text-sm font-medium text-foreground">Recipient</label>
                {selectedRecipient ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{selectedRecipient.name}</p>
                      <p className="text-xs text-muted-foreground">Account ID {selectedRecipient.id} · {selectedRecipient.username || selectedRecipient.student_employee_id} · {selectedRecipient.role}</p>
                    </div>
                    <Button type="button" size="icon" variant="ghost" aria-label="Clear selected recipient" onClick={() => { setSelectedRecipient(null); setRecipientSearch(""); }}><X /></Button>
                  </div>
                ) : (
                  <>
                <Input
                  id="notification-recipient-search"
                  value={recipientSearch}
                  onChange={(e) => { setRecipientSearch(e.target.value); setSelectedRecipient(null); }}
                  placeholder="Search by name, account ID, or username"
                  autoComplete="off"
                  aria-describedby="notification-recipient-help"
                />
                <p id="notification-recipient-help" className="text-xs text-muted-foreground">Enter at least 2 characters, then select the matching account.</p>
                {recipientSearch.trim().length >= 2 ? (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-background" aria-label="Matching accounts" aria-live="polite" aria-busy={recipientLoading}>
                    {recipientLoading ? <p className="px-3 py-4 text-sm text-muted-foreground">Searching accounts…</p>
                      : recipientError ? <p className="px-3 py-4 text-sm text-destructive">{recipientError}</p>
                        : recipientResults.length ? recipientResults.map((recipient) => (
                          <button key={recipient.id} type="button" aria-label={`Select ${recipient.name}, account ID ${recipient.id}, ${recipient.username || recipient.student_employee_id}`} className="flex w-full items-start gap-3 border-b border-border/70 px-3 py-2.5 text-left last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setSelectedRecipient(recipient); setRecipientSearch(""); }}>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{recipient.name}</span><span className="block truncate text-xs text-muted-foreground">ID {recipient.id} · {recipient.username || recipient.student_employee_id} · {recipient.role}</span></span>
                            <Check className="mt-1 size-4 shrink-0 text-muted-foreground" />
                          </button>
                        )) : <p className="px-3 py-4 text-sm text-muted-foreground">No active accounts matched. Try a name, ID, or username.</p>}
                  </div>
                ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {audienceHelp}
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-action">
                {success}
              </div>
            ) : null}

            <Button type="submit" disabled={createMutation.isPending || (form.audienceType === "user" && !selectedRecipient)}>
              <Send className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Sending..." : "Send notification"}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel
          title="Recently sent"
          description="The latest notifications stored in the database and available for live delivery."
        >
          <div className="space-y-3">
            {loading && !notificationsQuery.data ? <div className="space-y-3" aria-label="Loading notifications">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-24 w-full rounded-md" />)}</div> : notificationsQuery.isError && !notificationsQuery.data ? <div role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">{getApiErrorMessage(notificationsQuery.error, "Failed to load notifications")}<Button type="button" variant="link" className="ml-2 h-auto p-0" onClick={() => void notificationsQuery.refetch()}>Try again</Button></div> : notifications.length > 0 ? notifications.map((notification) => (
              <div key={notification.id} className="border border-border/80 bg-background px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-bold  text-action">
                        {notification.type}
                      </span>
                      <span className="text-xs  text-muted-foreground">
                        {notification.audience_type === "all"
                          ? "All users"
                          : notification.audience_type === "role"
                            ? `Role: ${notification.audience_role}`
                            : `${notification.audience_user_name || "Account"} · ${notification.audience_user_identifier || `ID ${notification.audience_user_id}`}`}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{notification.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    <div className="text-xs text-muted-foreground">
                      <span>By {notification.creator_name || "System"}</span>
                      <span className="mx-2">|</span>
                      <span>{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="border border-dashed border-border/80 px-4 py-8 text-sm text-muted-foreground">
                No notifications have been sent yet.
              </div>
            )}
            {!loading && notifications.length > 0 ? <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground"><Button type="button" variant="outline" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.totalPages}</span><Button type="button" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>Next</Button></div> : null}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
};

export default AdminNotifications;
