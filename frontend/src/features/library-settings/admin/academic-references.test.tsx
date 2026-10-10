// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";
import AcademicSettings from "./AdminHolidays";
import AdminUsersRedirect from "@/features/admin/manage/AdminUsersRedirect";
import * as api from "./api";

vi.mock("./api", () => ({ fetchLibrarySettings: vi.fn(), fetchAcademicPrograms: vi.fn(), fetchAcademicTerms: vi.fn(), fetchDepartments: vi.fn() }));
function Destination() { const location = useLocation(); return <output data-testid="destination">{location.pathname}{location.search}{location.hash}</output>; }
beforeEach(() => {
  vi.mocked(api.fetchLibrarySettings).mockResolvedValue({ settings: { overdue_fine_per_hour: 1, updated_at: null }, holidays: [] });
  vi.mocked(api.fetchAcademicPrograms).mockResolvedValue([{ id: 7, name: "Information Systems", is_active: 1, user_reference_count: 2, holding_reference_count: 0, created_at: "2026-10-01", updated_at: "2026-10-01" }]);
  vi.mocked(api.fetchAcademicTerms).mockResolvedValue([{ id: 8, name: "First term", starts_on: "2026-08-01", ends_on: "2026-12-01", is_current: 1, user_reference_count: 2 }]);
  vi.mocked(api.fetchDepartments).mockResolvedValue([{ id: 9, name: "Faculty", is_active: 1, user_reference_count: 2 }]);
});
afterEach(cleanup);
it.each([["programs", "programId", 7], ["terms", "termId", 8], ["departments", "departmentId", 9]])("opens Users with the correct %s reference filter", async (tab, filter, id) => {
  render(<MemoryRouter initialEntries={[`/admin/holidays?tab=${tab}`]}><Routes><Route path="/admin/holidays" element={<AcademicSettings />} /><Route path="/admin/manage" element={<Destination />} /></Routes></MemoryRouter>, { wrapper: createTestQueryClientWrapper() });
  const link = await screen.findByRole("link", { name: "2 user references" });
  expect(link).toHaveAttribute("href", expect.stringContaining(`/admin/manage?${filter}=${id}&status=all`));
  fireEvent.click(link);
  expect(await screen.findByTestId("destination")).toHaveTextContent(`/admin/manage?${filter}=${id}&status=all&academicLabel=`);
});
it("keeps academic and patron parameters when redirecting an older Users address", () => {
  render(<MemoryRouter initialEntries={["/admin/users?programId=7&status=all&academicLabel=Information%20Systems&patron=CARD-1#details"]}><Routes><Route path="/admin/users" element={<AdminUsersRedirect />} /><Route path="/admin/manage" element={<Destination />} /></Routes></MemoryRouter>);
  expect(screen.getByTestId("destination")).toHaveTextContent("/admin/manage?programId=7&status=all&academicLabel=Information%20Systems&patron=CARD-1#details");
});
