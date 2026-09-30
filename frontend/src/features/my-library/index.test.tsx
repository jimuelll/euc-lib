// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";
import type { MyLibraryDashboard } from "./types";

const api = vi.hoisted(() => ({
  fetchMyLibraryDashboard: vi.fn(),
  fetchMyLibraryHistory: vi.fn(),
  fetchMyLibraryAttendance: vi.fn(),
  fetchMyLibraryBarcode: vi.fn(),
}));
const notices = vi.hoisted(() => ({
  notifications: [] as Array<{
    id: number;
    title: string;
    body: string;
    href: string | null;
    created_at: string;
    is_read: boolean;
    read_at: string | null;
    type: string;
  }>,
  unreadCount: 0,
  loading: false,
  error: null as string | null,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./api", () => api);
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Alex Rivera", role: "employee" },
    loading: false,
    error: null as string | null,
  }),
}));
vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => notices,
}));
vi.mock("@/components/layout/Navbar", () => ({ default: () => null }));
vi.mock("@/components/layout/Footer", () => ({ default: () => null }));
vi.mock("@/features/recommendations", () => ({
  RecommendationStrip: ({ materialType }: { materialType: string }) => (
    <section aria-label={`${materialType} recommendations`} />
  ),
}));
import MyLibrary from "./index";

const dashboard: MyLibraryDashboard = {
  profile: {
    id: 1,
    name: "Alex Rivera",
    role: "employee",
    student_employee_id: "EMP-001",
    email: null,
    profile_picture: null,
    address: "",
    contact: "",
  },
  summary: {
    active_borrows: 0,
    overdue_borrows: 0,
    due_soon_borrows: 0,
    total_fines_due: 0,
    active_reservations: 0,
    ready_reservations: 0,
    attendance_logs: 0,
  },
  active_borrows: [],
  active_reservations: [],
  borrow_history: [],
  reservation_history: [],
  attendance_sessions: [],
  subscriptions: [],
  notifications: [],
};
const page = (number: number) => ({
  rows: [],
  pagination: { page: number, limit: 20, total: 40, totalPages: 2 },
});
function RouterControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Current URL">{location.search}</output>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
    </>
  );
}
function renderLibrary(entry = "/my-library") {
  const Wrapper = createTestQueryClientWrapper();
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[entry]}>
        <MyLibrary />
        <RouterControls />
      </MemoryRouter>
    </Wrapper>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  notices.notifications = [];
  notices.unreadCount = 0;
  notices.loading = false;
  api.fetchMyLibraryDashboard.mockResolvedValue(dashboard);
  api.fetchMyLibraryHistory.mockImplementation(async (number: number) =>
    page(number),
  );
  api.fetchMyLibraryAttendance.mockImplementation(async (number: number) =>
    page(number),
  );
  api.fetchMyLibraryBarcode.mockResolvedValue(
    new Blob(["qr"], { type: "image/png" }),
  );
  notices.markAsRead.mockResolvedValue(undefined);
  notices.markAllAsRead.mockResolvedValue(undefined);
  notices.refresh.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => "blob:library-qr");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("My Library workspace", () => {
  it("defaults invalid views to Overview and loads history only when visited", async () => {
    renderLibrary("/my-library?view=invalid&keep=yes");
    expect(
      await screen.findByRole("region", { name: "Borrowed books" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(api.fetchMyLibraryHistory).not.toHaveBeenCalled();
    expect(api.fetchMyLibraryAttendance).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "book recommendations" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "History" }));
    await waitFor(() =>
      expect(api.fetchMyLibraryHistory).toHaveBeenCalledWith(
        1,
        expect.any(AbortSignal),
      ),
    );
    expect(api.fetchMyLibraryAttendance).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "view=history&keep=yes",
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
  });
  it("keeps loan and visit pagination independent", async () => {
    renderLibrary("/my-library?view=history");
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(api.fetchMyLibraryHistory).toHaveBeenCalledWith(
        2,
        expect.any(AbortSignal),
      ),
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Library visits" }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() =>
      expect(api.fetchMyLibraryAttendance).toHaveBeenCalledWith(
        1,
        expect.any(AbortSignal),
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(api.fetchMyLibraryAttendance).toHaveBeenCalledWith(
        2,
        expect.any(AbortSignal),
      ),
    );
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: "Loans & reservations" }),
      { button: 0, ctrlKey: false },
    );
    await waitFor(() =>
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument(),
    );
  });
  it("mounts recommendations in Discover and opens the QR dialog with focus restoration", async () => {
    renderLibrary();
    await screen.findByText("No fines due");
    fireEvent.click(screen.getByRole("link", { name: "Discover" }));
    expect(
      screen.getByRole("region", { name: "book recommendations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "thesis recommendations" }),
    ).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Show QR code" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("img", { name: "Your library account QR code" }),
    ).toBeInTheDocument();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Download PNG" }),
    );
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("does not show zero counts or a healthy account before data arrives, and supports retry", async () => {
    api.fetchMyLibraryDashboard.mockRejectedValueOnce(new Error("Offline"));
    renderLibrary();
    expect(screen.queryByText("No fines due")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Borrowed books" }),
    ).not.toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No fines due")).toBeInTheDocument();
  });
  it("retains loaded account content after a refresh failure", async () => {
    // A manual refetch exercises a refresh of real cached data rather than a mock loading flag.
    const { QueryClient, QueryClientProvider } =
      await import("@tanstack/react-query");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MyLibrary />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("No fines due");
    api.fetchMyLibraryDashboard.mockRejectedValue(new Error("Offline"));
    await client.refetchQueries({ queryKey: ["my-library", "dashboard"] });
    expect(
      await screen.findByText(/Previously loaded information is shown/),
    ).toBeInTheDocument();
    expect(screen.getByText("No fines due")).toBeInTheDocument();
  });
  it("retries a failed QR fetch independently and cleans up its image URL", async () => {
    api.fetchMyLibraryBarcode.mockRejectedValueOnce(new Error("QR offline"));
    const mounted = renderLibrary();
    await screen.findByText("No fines due");
    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("img", { name: "Your library account QR code" });
    expect(api.fetchMyLibraryDashboard).toHaveBeenCalledOnce();
    mounted.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:library-qr");
  });
  it("retains notification destinations and read actions", async () => {
    notices.notifications = [
      {
        id: 42,
        type: "announcement",
        title: "Library notice",
        body: "Opening hours changed.",
        href: "/bulletin",
        created_at: new Date().toISOString(),
        is_read: false,
        read_at: null,
      },
    ];
    notices.unreadCount = 1;
    renderLibrary("/my-library?view=updates");
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(notices.markAllAsRead).toHaveBeenCalledOnce());
    const notice = screen.getByRole("link", { name: /Library notice/ });
    expect(notice).toHaveAttribute("href", "/bulletin");
    fireEvent.click(notice);
    expect(notices.markAsRead).toHaveBeenCalledWith(42);
  });
});
