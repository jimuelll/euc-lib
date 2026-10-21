// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import BookHoldingsEditor from "./BookHoldingsEditor";
import type { CatalogHolding } from "../catalog.api";
import type { AcademicProgram } from "@/features/library-settings";
import { fetchBookHoldings, voidCopyAccession, updateCatalogCopyCondition } from "../catalog.api";
import { fetchAcademicPrograms } from "@/features/library-settings";
import { printHolding } from "../catalog.holdings-print";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";

vi.mock("../catalog.holdings-print",()=>({printHolding:vi.fn().mockResolvedValue(undefined)}));
vi.mock("../catalog.api", () => ({ fetchBookHoldings: vi.fn(), saveCopyHolding: vi.fn(), voidCopyAccession: vi.fn(), updateCatalogCopyCondition: vi.fn() }));
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
  { wrapper: createTestQueryClientWrapper() },
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBookHoldings).mockResolvedValue(copies);
  vi.mocked(fetchAcademicPrograms).mockResolvedValue([{ id: 2, name: "Library Science" } as AcademicProgram]);
  vi.mocked(voidCopyAccession).mockResolvedValue({ accessionNumber: "ACC-1" });
});
afterEach(cleanup);

describe("copy holdings editor", () => {
  it("does not substitute another copy when the controlled copy is missing", async () => {
    render(<MemoryRouter><BookHoldingsEditor bookId={4} bookTitle="Atlas" copyId={999} guardRef={{current:null}} onManageCopies={vi.fn()} /></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});
    expect(await screen.findByRole("alert")).toHaveTextContent("This copy is no longer available");
    expect(screen.queryByLabelText(/Accession number/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Save holding"})).not.toBeInTheDocument();
  });
  it("keeps existing retired-copy and staff accession permissions", async () => {
    vi.mocked(fetchBookHoldings).mockResolvedValue([{...copies[0],is_active:0}]);
    renderEditor();
    expect(await screen.findByText(/This copy is retired. Its accession is permanent/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Accession number/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Price")).toBeEnabled();
    expect(screen.queryByRole("button",{name:"Void mistaken accession"})).not.toBeInTheDocument();
  });
  it("does not render a numeric false flag as a stray zero below the policy", async () => {
    vi.mocked(fetchBookHoldings).mockResolvedValue([{ ...copies[0], accession_voided: 0 }]);
    renderEditor();
    await screen.findByText("Accession ACC-1");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("Permanent after first save")).toBeInTheDocument();
  });
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

  it("warns before switching copies with unsaved holding edits", async () => {
    renderEditor();
    await screen.findByText("Accession ACC-1");
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "11.00" } });
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
    expect(screen.getByRole("button", { name: "Void mistaken accession" })).toBeEnabled();
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

it("updates the selected holdings copy condition without discarding unsaved accession details",async()=>{
 vi.mocked(updateCatalogCopyCondition).mockImplementation(async(id,condition)=>{
   vi.mocked(fetchBookHoldings).mockResolvedValue(copies.map(copy=>copy.copy_id===id?{...copy,condition}:copy));
 });
 renderEditor();
 const condition=await screen.findByLabelText("Copy condition");
 fireEvent.change(screen.getByLabelText("Location"),{target:{value:"Edited shelf"}});
 fireEvent.change(condition,{target:{value:"weeded"}});
 await waitFor(()=>expect(updateCatalogCopyCondition).toHaveBeenCalledWith(11,"weeded"));
 await waitFor(()=>expect(screen.getByLabelText("Copy condition")).toHaveValue("weeded"));
 expect(screen.getByLabelText("Location")).toHaveValue("Edited shelf");
 expect(screen.getByRole("option",{name:"Discarded"})).toBeInTheDocument();
});
it("shows failed condition changes and retains the saved condition",async()=>{
 vi.mocked(updateCatalogCopyCondition).mockRejectedValue({isAxiosError:true,response:{data:{message:"Return this copy before marking it discarded"}}});
 renderEditor();
 fireEvent.change(await screen.findByLabelText("Copy condition"),{target:{value:"discarded"}});
 expect(await screen.findByRole("alert")).toHaveTextContent("Return this copy before marking it discarded");
 expect(screen.getByLabelText("Copy condition")).toHaveValue("good");
});

it("prints the selected holdings data directly from the holdings drawer",async()=>{
 vi.mocked(printHolding).mockResolvedValue(undefined);
 renderEditor();
 fireEvent.click(await screen.findByRole("button",{name:"Print holdings"}));
 await waitFor(()=>expect(printHolding).toHaveBeenCalledWith(expect.objectContaining({copy_id:11,accession_number:"ACC-1",location:"Shelf A"})));
 fireEvent.click(screen.getByRole("button",{name:"Next"}));
 await waitFor(()=>expect(screen.getByText("Accession ACC-2")).toBeInTheDocument());
 fireEvent.click(screen.getByRole("button",{name:"Print holdings"}));
 await waitFor(()=>expect(printHolding).toHaveBeenLastCalledWith(expect.objectContaining({copy_id:12,accession_number:"ACC-2",location:"Shelf B"})));
});
