// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
const service = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
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
const showUpdates = () =>
  render(
    <MemoryRouter>
      <NotificationsProvider>
        <Updates />
      </NotificationsProvider>
    </MemoryRouter>,
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
