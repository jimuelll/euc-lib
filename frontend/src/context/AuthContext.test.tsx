// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createTestQueryClient } from "@/test-utils/query-client";

const { post, refreshAccessToken, toastError } = vi.hoisted(() => ({ post: vi.fn(), refreshAccessToken: vi.fn(), toastError: vi.fn() }));
vi.mock("@/utils/AxiosInstance", () => ({
  default: { post },
  setAuthFailureHandler: vi.fn(),
  setAuthRefreshHandler: vi.fn(),
  setInMemoryToken: vi.fn(),
  refreshAccessToken,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: toastError } }));

import { AuthProvider, useAuth } from "./AuthContext";

const makeToken = (id: number, name: string) =>
  `header.${btoa(JSON.stringify({ id, role: "student", name, must_change_password: false }))}.signature`;

function AuthProbe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span>{user?.name ?? "Signed out"}</span>
      <button onClick={() => void login("ACCOUNT-B", "password")}>Switch account</button>
      <button onClick={() => void logout()}>Log out</button>
    </div>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  post.mockImplementation((url: string) => {
    if (url === "/api/auth/refresh") {
      return Promise.resolve({ data: { accessToken: makeToken(1, "Account A") } });
    }
    if (url === "/api/auth/login") {
      return Promise.resolve({ data: { accessToken: makeToken(2, "Account B") } });
    }
    return Promise.resolve({ data: {} });
  });
  refreshAccessToken.mockResolvedValue(makeToken(1, "Account A"));
});

afterEach(cleanup);

describe("auth query-cache isolation", () => {
  it("clears cached server data when the account changes or logs out", async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuthProvider><AuthProbe /></AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Account A")).toBeTruthy();
    client.setQueryData(["sensitive"], "account A data");
    fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
    expect(await screen.findByText("Account B")).toBeTruthy();
    await waitFor(() => expect(client.getQueryData(["sensitive"])).toBeUndefined());

    client.setQueryData(["sensitive"], "account B data");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(client.getQueryData(["sensitive"])).toBeUndefined());
    expect(await screen.findByText("Signed out")).toBeTruthy();
  });

  it("preserves the active session when bootstrap refresh is rate limited", async () => {
    refreshAccessToken
      .mockResolvedValueOnce(makeToken(1, "Account A"))
      .mockRejectedValueOnce({ response: { status: 429, data: { message: "Retry in one minute." } } });

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <StrictMode><AuthProvider><AuthProbe /></AuthProvider></StrictMode>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Account A")).toBeTruthy();
    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Account A")).toBeTruthy();
    expect(toastError).toHaveBeenCalledWith("Retry in one minute.");
  });
});


function DestinationProbe() {
  const { login, changePassword, loading } = useAuth();
  const location = useLocation();
  return <><output aria-label="Current task">{location.pathname + location.search + location.hash}</output>
    <button disabled={loading} onClick={() => void login("ACCOUNT-B", "password", false, "/services/borrowing?bookId=42#reservation-7")}>Resume task</button>
    <button disabled={loading} onClick={() => void changePassword("old", "new")}>Complete password change</button></>;
}
function mountDestination(entry: string) {
  return render(<QueryClientProvider client={createTestQueryClient()}><MemoryRouter initialEntries={[entry]}><AuthProvider><DestinationProbe /></AuthProvider></MemoryRouter></QueryClientProvider>);
}
describe("authentication navigation", () => {
  it("navigates to the supplied task after successful login", async () => {
    mountDestination("/login");
    await waitFor(() => expect((screen.getByText("Resume task") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText("Resume task"));
    await waitFor(() => expect(screen.getByLabelText("Current task").textContent).toBe("/services/borrowing?bookId=42#reservation-7"));
  });
  it.each([["/services/borrowing?bookId=42#reservation-7", "/services/borrowing?bookId=42#reservation-7"], ["/change-password", "/"]])("retains gated task and standalone fallback for %s", async (entry, expected) => {
    refreshAccessToken.mockResolvedValue(`header.${btoa(JSON.stringify({ id: 1, role: "student", name: "Account A", must_change_password: true }))}.signature`);
    post.mockResolvedValue({ data: { accessToken: makeToken(1, "Account A") } });
    mountDestination(entry);
    await waitFor(() => expect((screen.getByText("Complete password change") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText("Complete password change"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/auth/change-password", { oldPassword: "old", newPassword: "new" }));
    await waitFor(() => expect(screen.getByLabelText("Current task").textContent).toBe(expected));
  });
});
