// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReturnLookup from "./ReturnLookup";
import type { ReturnPreview } from "../circulation.types";

vi.mock("@/features/scan-qr", () => ({ useZxingScanner: () => ({ videoRef: { current: null }, error: null }) }));
vi.mock("./ReturnFineActions", () => ({ default: () => <p>Calculated fine</p> }));
afterEach(cleanup);
it("autofocuses the scanner and requires a loaded preview before Enter can confirm", () => {
  const onLookup = vi.fn();
  const onConfirm = vi.fn();
  const props = { identifier: "ACC-1", onIdentifierChange: vi.fn(), onLookup, onConfirm, lookingUp: false, submitting: false, preview: null, receipt: null, error: "" };
  const view = render(<ReturnLookup {...props} />);
  const input = screen.getByRole("textbox", { name: "Accession number or copy QR code" });
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onLookup).toHaveBeenCalledWith("ACC-1");
  expect(onConfirm).not.toHaveBeenCalled();
  const preview = { borrowing_id: 1, title: "Test book", user_name: "Patron", student_employee_id: "TEST-1", accession_number: "ACC-1", due_date: "2026-10-15T09:00:00", status: "borrowed" } as ReturnPreview;
  view.rerender(<ReturnLookup {...props} preview={preview} />);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  view.rerender(<ReturnLookup {...props} preview={preview} submitting />);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
