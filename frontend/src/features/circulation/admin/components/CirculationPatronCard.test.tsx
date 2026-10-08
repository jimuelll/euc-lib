// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { createTestQueryClient } from "@/test-utils/query-client";
import CirculationPatronCard from "./CirculationPatronCard";
afterEach(cleanup);
it("shows real patron risks and the clearance destination before confirmation", () => {
  render(<QueryClientProvider client={createTestQueryClient()}><MemoryRouter><CirculationPatronCard patron={{ user: { id: 1, name: "Mika", role: "student", barcode: "ID-1", student_employee_id: "ID-1" }, activeBorrows: [{ id: 9 } as never, { id: 10 } as never], clearance: { status: "blocked", reasons: ["Resolve overdue loans"], overdueItems: [{ id: 9, title: "Book" }], outstandingAmount: 350 } }} /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText("Borrowing blocked")).toBeTruthy();
  expect(screen.getByText("Resolve overdue loans")).toBeTruthy();
  expect(screen.getByText("₱350.00")).toBeTruthy();
  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.getByText("1")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Review clearance" }).getAttribute("href")).toBe("/admin/clearance?student_employee_id=ID-1");
});
