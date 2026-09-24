// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import BookHoldingsEditor from "./BookHoldingsEditor";
import type { CatalogHolding } from "../catalog.api";
import type { AcademicProgram } from "@/features/library-settings";
import { fetchBookHoldings, voidCopyAccession } from "../catalog.api";
import { fetchAcademicPrograms } from "@/features/library-settings";

vi.mock("../catalog.api", () => ({ fetchBookHoldings: vi.fn(), saveCopyHolding: vi.fn(), voidCopyAccession: vi.fn() }));
vi.mock("@/features/library-settings", () => ({ fetchAcademicPrograms: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const copies: CatalogHolding[] = [
  { copy_id: 11, book_id: 4, barcode: "LIB-000004-001", condition: "good", is_active: 1, title: "Atlas", book_type: "General", accession_number: "ACC-1", price: "10.00", program_id: 2, course: "Library Science", course_code: "LIS101", location: "Shelf A", date_acquired: "2026-01-01", distributor: "Books Inc", invoice_reference: "OR-1", circulation_status: "available" },
  { copy_id: 12, book_id: 4, barcode: "LIB-000004-002", condition: "damaged", is_active: 1, title: "Atlas", book_type: "General", accession_number: "ACC-2", price: "12.50", program_id: null, course: null, course_code: null, location: "Shelf B", date_acquired: null, distributor: null, invoice_reference: null, circulation_status: "available" },
];

const renderEditor = (isSuperAdmin = false) => render(
  <MemoryRouter>
    <BookHoldingsEditor bookId={4} bookTitle="Atlas" guardRef={{ current: null }} onManageCopies={vi.fn()} isSuperAdmin={isSuperAdmin} />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBookHoldings).mockResolvedValue(copies);
  vi.mocked(fetchAcademicPrograms).mockResolvedValue([{ id: 2, name: "Library Science" } as AcademicProgram]);
  vi.mocked(voidCopyAccession).mockResolvedValue({ accessionNumber: "ACC-1" });
});
afterEach(cleanup);

describe("copy holdings editor", () => {
  it("navigates between separate physical copies with Previous and Next", async () => {
    renderEditor();
    expect(await screen.findByText("Accession ACC-1")).toBeTruthy();
    expect(screen.getByText("Copy 1")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Copy 1 · LIB-000004-001/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Accession ACC-2")).toBeTruthy();
    expect(screen.getByText("Copy 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("warns before switching copies with unsaved accession details", async () => {
    renderEditor();
    await screen.findByText("Accession ACC-1");
    fireEvent.change(screen.getByLabelText(/Accession number/), { target: { value: "ACC-1-edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Discard unsaved changes?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.getByText("Accession ACC-2")).toBeTruthy());
  });

  it("lets a super admin void a mistaken accession without changing its permanent number", async () => {
    const voidedCopies = [{ ...copies[0], accession_voided: 1 }, copies[1]];
    vi.mocked(fetchBookHoldings).mockResolvedValueOnce(copies).mockResolvedValueOnce(voidedCopies);
    renderEditor(true);
    await screen.findByText("Accession ACC-1");
    expect(screen.getByLabelText(/Accession number/)).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Void mistaken accession" }));
    expect(await screen.findByRole("heading", { name: "Void accession number" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Transcription error" } });
    fireEvent.click(screen.getByRole("button", { name: "Void accession permanently" }));
    await waitFor(() => expect(voidCopyAccession).toHaveBeenCalledWith(11, { reason: "Transcription error" }));
    expect(await screen.findByText(/This accession is permanently voided/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Accession number/)).toHaveValue("ACC-1");
    expect(screen.getByLabelText(/Accession number/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Price")).toBeEnabled();
  });
});
