// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
const auth = vi.hoisted(() => ({ login: vi.fn(), isLoggedIn: false, loading: false, user: null }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/layout/Navbar", () => ({ default: () => null }));
vi.mock("@/components/layout/Footer", () => ({ default: () => null }));
import Login from "./Login";
import ProtectedRoute from "../components/ProtectedRoute";
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); auth.isLoggedIn = false; auth.login.mockResolvedValue(undefined); });
function Location() { const location = useLocation(); return <output aria-label="Destination">{location.pathname + location.search + location.hash}</output>; }
function mount(entry: string) {
  render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/my-library" element={<ProtectedRoute><div>Account</div></ProtectedRoute>} />
    <Route path="*" element={<div>Destination page</div>} />
  </Routes><Location /></MemoryRouter>);
}
function submit() {
  fireEvent.change(screen.getByLabelText("Account ID"), { target: { value: "STUDENT" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}
describe("sign-in task continuity", () => {
  it.each(["/services/borrowing?bookId=42", "/services/subscriptions", "/my-library?tab=history#reservations"])("passes destination %s through failed login and retry", async destination => {
    auth.login.mockRejectedValueOnce(new Error("Wrong password"));
    mount(`/login?${new URLSearchParams({ returnTo: destination })}`);
    submit();
    expect(await screen.findByText("Wrong password")).toBeInTheDocument();
    submit();
    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(2));
    expect(auth.login).toHaveBeenLastCalledWith("STUDENT", "password", false, destination);
  });
  it.each([["/login", "/"], ["/login?for=reserve", "/services/borrowing"], ["/login?returnTo=https://evil.test", "/"]])("handles default, legacy, and unsafe links: %s", async (entry, destination) => {
    mount(entry); submit();
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith("STUDENT", "password", false, destination));
  });
  it("redirects an authenticated visitor to their destination", async () => {
    auth.isLoggedIn = true;
    mount("/login?returnTo=%2Fservices%2Fsubscriptions");
    await waitFor(() => expect(screen.getByLabelText("Destination")).toHaveTextContent("/services/subscriptions"));
    expect(screen.queryByLabelText("Account ID")).not.toBeInTheDocument();
  });
  it("preserves protected pathname, query and hash in the login URL", async () => {
    mount("/my-library?tab=history#reservations");
    await screen.findByLabelText("Account ID");
    const url = screen.getByLabelText("Destination").textContent!;
    expect(new URLSearchParams(url.split("?")[1]).get("returnTo")).toBe("/my-library?tab=history#reservations");
  });
});
