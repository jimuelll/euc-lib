// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LoginRequiredProvider, useLoginRequired } from "./LoginRequired";

const auth = vi.hoisted(() => ({ isLoggedIn: false }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.isLoggedIn = false; });

const Trigger = ({ returnTo }: { returnTo?: string }) => {
  const { requireLogin } = useLoginRequired();
  return <button onClick={() => requireLogin({ title: "Sign in to react", message: "Needs an account.", returnTo })}>Act</button>;
};
const mount = (returnTo?: string) => render(<MemoryRouter initialEntries={["/bulletin?post=4"]}><LoginRequiredProvider><Trigger returnTo={returnTo} /></LoginRequiredProvider></MemoryRouter>);

it("shows a modal with the supplied copy instead of navigating", () => {
  mount();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByText("Act"));
  expect(screen.getByRole("dialog", { name: "Sign in to react" })).toHaveTextContent("Needs an account.");
});
it("returns to the current page after signing in by default", () => {
  mount();
  fireEvent.click(screen.getByText("Act"));
  const href = screen.getByRole("link", { name: /Sign in/ }).getAttribute("href")!;
  expect(new URLSearchParams(href.split("?")[1]).get("returnTo")).toBe("/bulletin?post=4");
});
it("honours an explicit return destination and closes on Not now", () => {
  mount("/services/subscriptions");
  fireEvent.click(screen.getByText("Act"));
  const href = screen.getByRole("link", { name: /Sign in/ }).getAttribute("href")!;
  expect(new URLSearchParams(href.split("?")[1]).get("returnTo")).toBe("/services/subscriptions");
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
