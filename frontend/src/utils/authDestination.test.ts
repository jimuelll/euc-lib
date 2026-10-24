import { describe, expect, it } from "vitest";
import { authDestination, loginDestination } from "./authDestination";

describe("authentication destinations", () => {
  it.each(["/services/borrowing?bookId=42#reservation-9", "/services/subscriptions", "/my-library?tab=history#reservations", "/catalogue?q=Two%20words"])("retains local destination %s", path => {
    expect(authDestination(path)).toBe(path);
    expect(new URLSearchParams(loginDestination(path).split("?")[1]).get("returnTo")).toBe(path);
  });
  it.each([undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2fevil.test", "/login", "/LOGIN/?returnTo=/login", "/x/../login", "/%6cogin", "/bad%", "/%00evil", "javascript:alert(1)"])("rejects unsafe destination %s", path => {
    expect(authDestination(path)).toBe("/");
  });
});
