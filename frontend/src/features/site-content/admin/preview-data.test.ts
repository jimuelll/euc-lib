import { describe, expect, it } from "vitest";
import { resolvePreviewData, type PreviewSnapshot } from "./preview-data";

const snapshot: PreviewSnapshot = {
  section: "homepage", user: null, token: null, role: "staff", documents: {
    homepage: { hero_title: "Unsaved title" },
    subscriptions: { items: [
      { id: 1, title: "Hidden", is_active: false },
      { id: 2, title: "Second", is_active: true, sort_order: 2 },
      { title: "First", is_active: true, sort_order: 1 },
      { id: 3, title: "Deleted", is_active: true, deleted: true },
    ] },
    events: { items: [
      { title: "Past", starts_at: "2000-01-01" },
      { title: "Later", starts_at: "2099-02-01" },
      { title: "Ongoing", starts_at: "2000-01-01", ends_at: "2099-01-01" },
    ] },
    guide: { items: [
      { title: "Admin only", is_published: true, audience_roles: ["admin"] },
      { title: "Unpublished", is_published: false, audience_roles: ["staff"] },
      { title: "Staff topic", is_published: true, audience_roles: ["staff"], before_you_begin: ["Bring a card"] },
    ] },
    bulletin: { items: [
      { title: "Older", content: "Library", created_at: "2026-01-01" },
      { title: "Archived", archived: true },
      { title: "Pinned", content: "Library", is_pinned: true, created_at: "2025-01-01" },
      { title: "Newer", content: "Research", created_at: "2026-02-01" },
    ] },
  },
};

describe("draft data for production pages", () => {
  it("uses unsaved page fields without changing the source", () => {
    expect(resolvePreviewData(snapshot, "/api/site-content")).toEqual({ hero_title: "Unsaved title" });
    expect(snapshot.documents.subscriptions?.items[2].id).toBeUndefined();
  });
  it("hides deleted and inactive resources and preserves display order", () => {
    expect(resolvePreviewData(snapshot, "/api/subscriptions")).toMatchObject({ data: [{ title: "First" }, { title: "Second" }] });
  });
  it("includes ongoing events and excludes past events", () => {
    expect(resolvePreviewData(snapshot, "/api/events")).toMatchObject([{ title: "Ongoing" }, { title: "Later" }]);
  });
  it("matches guide visibility for the selected role and preserves prerequisites", () => {
    expect(resolvePreviewData(snapshot, "/api/user-guide")).toMatchObject([{ title: "Staff topic", before_you_begin: ["Bring a card"] }]);
    expect(resolvePreviewData({ ...snapshot, role: "admin" }, "/api/user-guide")).toMatchObject([{ title: "Admin only" }]);
  });
  it("matches bulletin pinning, date order, pagination and search", () => {
    expect(resolvePreviewData(snapshot, "/api/bulletin", { page: 1, limit: 2 })).toMatchObject({ data: [{ title: "Pinned" }, { title: "Newer" }], total: 3, totalPages: 2 });
    expect(resolvePreviewData(snapshot, "/api/bulletin", { search: " research " })).toMatchObject({ data: [{ title: "Newer" }], total: 1 });
    expect(resolvePreviewData(snapshot, "/api/bulletin", { page: 2, limit: 2 })).toMatchObject({ data: [{ title: "Older" }] });
  });
  it("leaves unrelated reads to the server", () => {
    expect(resolvePreviewData(snapshot, "/api/catalogue")).toBeUndefined();
  });
});
