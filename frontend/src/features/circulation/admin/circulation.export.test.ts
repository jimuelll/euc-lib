import { beforeEach, expect, it, vi } from "vitest";
import { getCirculationLog, type CirculationLogEntry } from "./circulation.api";
import { fetchCirculationExport, circulationCsv } from "./circulation.export";
vi.mock("./circulation.api", () => ({ getCirculationLog: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("exports all filtered pages with abort support and removes pagination duplicates", async () => {
  vi.mocked(getCirculationLog).mockResolvedValueOnce({ rows: [{ id: 1 } as CirculationLogEntry], page: 1, totalPages: 2, total: 2 }).mockResolvedValueOnce({ rows: [{ id: 1 } as CirculationLogEntry, { id: 2 } as CirculationLogEntry], page: 2, totalPages: 2, total: 2 });
  const signal = new AbortController().signal;
  expect((await fetchCirculationExport({ status: "overdue", search: "Mika" }, signal)).map(row => row.id)).toEqual([1, 2]);
  expect(getCirculationLog).toHaveBeenNthCalledWith(2, { status: "overdue", search: "Mika", limit: 50, page: 2 }, signal);
});
it("escapes quotes and prevents spreadsheet formula evaluation", () => {
  const csv = circulationCsv([{ user_name: '=HYPERLINK("example")', book_title: 'Title, "Volume 1"', student_employee_id: "ID-1" } as CirculationLogEntry]);
  expect(csv).toContain('"\'=HYPERLINK(""example"")"');
  expect(csv).toContain('"Title, ""Volume 1"""');
});
