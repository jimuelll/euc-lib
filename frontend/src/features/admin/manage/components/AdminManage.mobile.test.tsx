// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SearchResultsTable } from "./AdminManage.components";

afterEach(cleanup);

it("keeps account review and QR actions available in the mobile record", () => {
  const onSelect = vi.fn();
  const onViewQr = vi.fn();
  const user = { student_employee_id: "2026-001", name: "Alex Rivera", role: "student", program_course: "BS Information Systems", is_active: 1 };
  render(<SearchResultsTable results={[user]} showArchived={false} onSelect={onSelect} onViewQr={onViewQr} />);

  const record = within(screen.getByLabelText("User records"));
  expect(record.getByText("Alex Rivera")).toBeInTheDocument();
  expect(record.getByText("BS Information Systems")).toBeInTheDocument();
  fireEvent.click(record.getByRole("button", { name: "Edit account" }));
  fireEvent.click(record.getByRole("button", { name: "View QR" }));
  expect(onSelect).toHaveBeenCalledWith(user);
  expect(onViewQr).toHaveBeenCalledWith(user);
});

it("offers review and no QR action for an archived mobile account", () => {
  const onSelect = vi.fn();
  const user = { student_employee_id: "2026-002", name: "Sam Cruz", role: "staff", deleted_at: "2026-09-01" };
  render(<SearchResultsTable results={[user]} showArchived onSelect={onSelect} onViewQr={vi.fn()} />);
  const record = within(screen.getByLabelText("User records"));
  expect(record.queryByRole("button", { name: "View QR" })).not.toBeInTheDocument();
  fireEvent.click(record.getByRole("button", { name: "Review account" }));
  expect(onSelect).toHaveBeenCalledWith(user);
});
