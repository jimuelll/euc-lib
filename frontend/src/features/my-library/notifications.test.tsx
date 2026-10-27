// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
const service = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  fetchNotification:vi.fn(),
}));
vi.mock("@/features/notifications/notifications.service", () => service);
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, role: "employee" },
    loading: false,
    getToken: () => null,
  }),
}));
import {
  NotificationsProvider,
  useNotifications,
} from "@/context/NotificationsContext";
import {createTestQueryClientWrapper} from "@/test-utils/query-client";
import MyLibraryUpdatesPanel from "./components/MyLibraryUpdatesPanel";
function Updates() {
  const value = useNotifications();
  return (
    <>
      <button onClick={() => void value.refresh()}>Refresh notices</button>
      <MyLibraryUpdatesPanel
        {...value}
        state={{
          loading: value.loading,
          refreshing: value.loading,
          error: value.error,
          retry: value.refresh,
        }}
      />
    </>
  );
}
function NotificationLocation(){return <output data-testid="notification-location">{useLocation().search}</output>;}
const showUpdates = (url="/my-library?view=updates") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <NotificationsProvider>
        <Updates /><NotificationLocation/>
      </NotificationsProvider>
    </MemoryRouter>,
    {wrapper:createTestQueryClientWrapper()},
  );
beforeEach(() => {
  vi.clearAllMocks();
  service.fetchUnreadCount.mockResolvedValue(0);
  service.fetchNotifications.mockResolvedValue([]);
});
afterEach(cleanup);
describe("notification failure states", () => {
  it("does not claim an empty account on failed fetching and supports retry", async () => {
    service.fetchNotifications.mockRejectedValueOnce(new Error("Offline"));
    showUpdates();
    expect(screen.queryByText(/You're all caught up/)).not.toBeInTheDocument();
    expect(
      await screen.findByText("Library updates could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You're all caught up/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/You're all caught up/)).toBeInTheDocument();
  });
  it("catches a background refresh rejection and preserves cached notices", async () => {
    service.fetchNotifications
      .mockResolvedValueOnce([
        {
          id: 42,
          title: "Cached notice",
          type: "announcement",
          body: "A saved notice",
          created_at: "invalid",
          href: null,
          is_read: false,
          read_at: null,
        },
      ])
      .mockRejectedValueOnce(new Error("Offline"));
    showUpdates();
    await screen.findByRole("heading", { name: "Cached notice" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh notices" }));
    expect(
      await screen.findByText(/Previously loaded notices are shown/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cached notice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
  });
});

it('opens an update in the shared reader instead of navigating directly',async()=>{
 const record={id:41,type:'announcement',title:'Full notice',body:'Full message',href:'/bulletin',audience_type:'all',audience_user_id:null,audience_role:null,created_at:'2026-10-27T00:00:00Z',expires_at:null,is_active:true,created_by:1,is_read:false,read_at:null};
 service.fetchNotifications.mockResolvedValue([record]);service.fetchNotification.mockResolvedValue(record);service.markNotificationRead.mockResolvedValue({unreadCount:0});showUpdates();fireEvent.click(await screen.findByRole('button',{name:/Full notice/}));await screen.findByRole('dialog');await waitFor(()=>expect(service.fetchNotification).toHaveBeenCalledWith(41,expect.any(AbortSignal)));expect(screen.getByTestId('notification-location').textContent).toContain('notification=41');expect(screen.getByTestId('notification-location').textContent).toContain('view=updates');
});
it('restores a notification deep link and leaves Updates visible after closing',async()=>{
 service.fetchNotification.mockResolvedValue({id:41,type:'announcement',title:'Deep-linked notice',body:'Full message',href:null,created_at:'2026-10-27T00:00:00Z',expires_at:null,is_read:true});showUpdates('/my-library?view=updates&notification=41');const dialog=within(await screen.findByRole('dialog'));await dialog.findByRole('heading',{name:'Deep-linked notice'});fireEvent.click(dialog.getAllByRole('button',{name:'Close'})[0]);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByTestId('notification-location').textContent).toBe('?view=updates');
});
