import { useEffect, useMemo, useState } from "react";
import { BellRing, RefreshCw, Send, User, Users, Waves } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";

type AudienceType = "all" | "user" | "role";

interface AdminNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  audience_type: AudienceType;
  audience_user_id: number | null;
  audience_role: string | null;
  created_at: string;
  expires_at: string | null;
  creator_name: string | null;
}

interface AdminNotificationStats {
  total_notifications: number;
  created_today: number;
  broadcast_notifications: number;
  direct_notifications: number;
}

interface AdminNotificationsResponse {
  stats: AdminNotificationStats;
  notifications: AdminNotification[];
}

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
  audienceUserId: "",
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
  const [form, setForm] = useState(defaultForm);
  const [stats, setStats] = useState<AdminNotificationStats>(emptyStats);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosInstance.get<AdminNotificationsResponse>("/api/admin/notifications", {
        params: { limit: 20 },
      });
      setStats(res.data.stats);
      setNotifications(res.data.notifications);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const audienceHelp = useMemo(() => {
    if (form.audienceType === "user") return "Send this notification to one specific user ID.";
    if (form.audienceType === "role") return "Send this notification to every user under one role.";
    return "Broadcast this notification to all active users.";
  }, [form.audienceType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await axiosInstance.post("/api/admin/notifications", {
        type: form.type.trim() || "announcement",
        title: form.title,
        body: form.body,
        href: form.href || null,
        audienceType: form.audienceType,
        audienceUserId: form.audienceType === "user" ? Number(form.audienceUserId) : null,
        audienceRole: form.audienceType === "role" ? form.audienceRole : null,
        expiresAt: form.expiresAt || null,
      });

      setSuccess("Notification sent successfully.");
      setForm(defaultForm);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to send notification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      eyebrow="Content Management"
      title="Notifications"
      description="Send real-time notifications to all users, a role, or a single account and review recently sent messages."
      contentWidth="wide"
      actions={
        <Button type="button" variant="outline" onClick={loadData} disabled={loading || saving}>
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
                  onValueChange={(value: AudienceType) => setForm((prev) => ({ ...prev, audienceType: value }))}
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
                <label className="text-sm font-medium text-foreground">User ID</label>
                <Input
                  type="number"
                  min="1"
                  value={form.audienceUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, audienceUserId: e.target.value }))}
                  placeholder="14"
                  required
                />
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
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                {success}
              </div>
            ) : null}

            <Button type="submit" disabled={saving}>
              <Send className="mr-2 h-4 w-4" />
              {saving ? "Sending..." : "Send notification"}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel
          title="Recently sent"
          description="The latest notifications stored in the database and available for live delivery."
        >
          <div className="space-y-3">
            {notifications.length > 0 ? notifications.map((notification) => (
              <div key={notification.id} className="border border-border/80 bg-background px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        {notification.type}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {notification.audience_type === "all"
                          ? "All users"
                          : notification.audience_type === "role"
                            ? `Role: ${notification.audience_role}`
                            : `User ID: ${notification.audience_user_id}`}
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
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
};

export default AdminNotifications;
