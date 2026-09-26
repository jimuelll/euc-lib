// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { createTestQueryClient } from "@/test-utils/query-client";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/utils/AxiosInstance", () => ({
  default: { post },
  setAuthFailureHandler: vi.fn(),
  setAuthRefreshHandler: vi.fn(),
  setInMemoryToken: vi.fn(),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));

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
});
