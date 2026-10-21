// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createTestQueryClientWrapper } from "@/test-utils/query-client";
import AdminCatalogData from "./AdminCatalogData";
import { DEFAULT_FIELDS } from "./AdminCatalog.types";
import * as api from "./catalog.api";
import { fetchAcademicPrograms } from "@/features/library-settings";
import type { CatalogHolding } from "./catalog.api";
configure({asyncUtilTimeout:5000});
vi.mock("@/features/library-settings",()=>({fetchAcademicPrograms:vi.fn().mockResolvedValue([])}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:{role:"staff"}})}));
vi.mock("./catalog.api",()=>({searchCatalogBooks:vi.fn(),fetchBookTypes:vi.fn(),createCatalogBook:vi.fn(),updateCatalogBook:vi.fn(),archiveCatalogBook:vi.fn(),restoreCatalogBook:vi.fn(),lookupBookIsbn:vi.fn(),uploadCatalogBookImage:vi.fn(),fetchCatalogBookCopies:vi.fn(),fetchCatalogBarcode:vi.fn(),fetchCatalogHoldings:vi.fn(),fetchBookHoldings:vi.fn(),saveCopyHolding:vi.fn(),voidCopyAccession:vi.fn(),addCatalogCopies:vi.fn()}));
const book={id:1,title:"Book One",author:"Library Author",isbn:"9780306406157",material_type:"book" as const,book_type_id:1,copies:2,total_copies:2,available:1,accessioned_copies:1,unaccessioned_copies:1,active_loans:0,active_reservations:0,editors:[],subjects:["Research"]};
function Location(){return <output data-testid="route">{useLocation().search}</output>;}
function mount(entry="/admin/catalog"){const Wrapper=createTestQueryClientWrapper();return render(<Wrapper><MemoryRouter initialEntries={[entry]}><AdminCatalogData fields={DEFAULT_FIELDS} isSuperAdmin={false}/><Location/></MemoryRouter></Wrapper>);}
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.fetchCatalogHoldings).mockResolvedValue({rows:[],total:0,page:1,limit:25,pagination:{page:1,limit:25,total:0,totalPages:1},summary:{needs:0,available:0,borrowed:0,reserved:0,voided:0,all:0}});vi.mocked(fetchAcademicPrograms).mockResolvedValue([]);vi.mocked(api.searchCatalogBooks).mockResolvedValue({rows:[book],summary:{active:1,archived:0,needsHoldings:1,all:1},pagination:{page:1,limit:25,total:1,totalPages:1}});vi.mocked(api.fetchBookTypes).mockResolvedValue([{id:1,name:"General",is_active:1,default_borrow_days:7,loan_duration_minutes:10080,loan_duration_unit:"day",fine_per_hour:1}]);vi.mocked(api.updateCatalogBook).mockResolvedValue({message:"Saved"});vi.mocked(api.createCatalogBook).mockResolvedValue({id:2,message:"Created"});});
afterEach(cleanup);

const copy = (id: number, overrides: Partial<CatalogHolding> = {}): CatalogHolding => ({
  copy_id:id, book_id:1, title:book.title, barcode:`LIB-000001-00${id}`, condition:"good", is_active:1,
  accession_number:null, price:null, program_id:null, course:null, course_code:null, location:null,
  date_acquired:null, distributor:null, invoice_reference:null, circulation_status:"available", ...overrides,
});
function holdingsPage(rows: CatalogHolding[]) {
  return {rows,total:rows.length,page:1,limit:25,pagination:{page:1,limit:25,total:rows.length,totalPages:1},summary:{needs:rows.length,available:0,borrowed:0,reserved:0,voided:0,all:rows.length}};
}
function setupCopies(rows = [copy(1),copy(2),copy(3)]) {
  let copies = rows;
  vi.mocked(api.fetchBookHoldings).mockImplementation(async (_id) => copies.filter(item=>item.book_id===_id));
  vi.mocked(api.fetchCatalogHoldings).mockImplementation(async () => holdingsPage(copies.filter(item=>!item.accession_number)));
  vi.mocked(api.saveCopyHolding).mockImplementation(async (id,payload) => {
    copies=copies.map(item=>item.copy_id===id?{...item,...payload,program_id:payload.program_id?Number(payload.program_id):null}:item);
  });
  return {getCopies:()=>copies};
}
it("opens the exact Holdings copy directly and keeps page order after saved rows leave the filter", async () => {
  setupCopies([copy(1),copy(2,{book_id:2,title:"Book Two"}),copy(3)]);
  mount("/admin/catalog?tab=holdings&completion=missing&hq=LIB&hpage=2");
  const titles=await screen.findAllByRole("button",{name:"Book One"});
  fireEvent.click(titles[0]);
  const drawer=within(screen.getByRole("dialog"));
  await drawer.findByLabelText(/Accession number/);
  expect(drawer.queryByRole("tab",{name:"Copies"})).toBeNull();
  expect(drawer.getByRole("button",{name:"Previous"}).hasAttribute("disabled")).toBe(true);
  fireEvent.change(drawer.getByLabelText(/Accession number/),{target:{value:"ACC-1"}});
  fireEvent.click(drawer.getByRole("button",{name:"Save and next"}));
  await drawer.findByText("LIB-000001-002");
  expect(drawer.getByRole("heading",{name:"Book Two"})).toBeTruthy();
  expect(drawer.getByText("Copies in this results page · 2 of 3")).toBeTruthy();
  expect(api.saveCopyHolding).toHaveBeenCalledTimes(1);
  fireEvent.click(drawer.getByRole("button",{name:"Next"}));
  await drawer.findByText("LIB-000001-003");
  expect(drawer.getByRole("button",{name:"Next"}).hasAttribute("disabled")).toBe(true);
  expect(drawer.getByRole("button",{name:"Save and next"}).hasAttribute("disabled")).toBe(true);
  expect(screen.getByTestId("route").textContent).toBe("?tab=holdings&completion=missing&hq=LIB&hpage=2");
});
it("Save stays on the selected copy; a failed Save and next retains the draft", async () => {
  setupCopies(); mount("/admin/catalog?tab=holdings");
  fireEvent.click((await screen.findAllByRole("button",{name:"Book One"}))[1]);
  const drawer=within(screen.getByRole("dialog"));
  fireEvent.change(await drawer.findByLabelText(/Accession number/),{target:{value:"ACC-2"}});
  fireEvent.click(drawer.getByRole("button",{name:"Save holding"}));
  await waitFor(()=>expect(drawer.getByLabelText(/Accession number/).hasAttribute("readonly")).toBe(true));
  expect(drawer.getByText("Copies in this results page · 2 of 3")).toBeTruthy();
  vi.mocked(api.saveCopyHolding).mockRejectedValueOnce(new Error("Save failed"));
  fireEvent.change(drawer.getByLabelText("Location"),{target:{value:"Shelf C"}});
  fireEvent.click(drawer.getByRole("button",{name:"Save and next"}));
  await waitFor(()=>expect(api.saveCopyHolding).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(drawer.getByRole("button",{name:"Save holding"}).hasAttribute("disabled")).toBe(false));
  expect((drawer.getByLabelText("Location") as HTMLInputElement).value).toBe("Shelf C");
  expect(drawer.getByText("Copies in this results page · 2 of 3")).toBeTruthy();
});
it("guards copy navigation, record mode changes and closing, then restores list focus", async () => {
  setupCopies(); mount("/admin/catalog?tab=holdings&hstatus=all");
  const trigger=(await screen.findAllByRole("button",{name:"Book One"}))[0];
  trigger.focus();fireEvent.click(trigger);
  const drawer=within(screen.getByRole("dialog"));
  fireEvent.change(await drawer.findByLabelText(/Accession number/),{target:{value:"DRAFT"}});
  for (const name of ["Next","Edit record details","Close copy"]) {
    fireEvent.click(drawer.getByRole("button",{name}));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button",{name:"Keep editing"}));
    await waitFor(()=>expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((drawer.getByLabelText(/Accession number/) as HTMLInputElement).value).toBe("DRAFT");
  }
  fireEvent.click(drawer.getByRole("button",{name:"Close copy"}));
  fireEvent.click(await screen.findByRole("button",{name:"Discard changes"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(()=>expect(document.activeElement).toBe(trigger));
  expect(screen.getByTestId("route").textContent).toBe("?tab=holdings&hstatus=all");
});
it("replaces the focused drawer with record details without stacking drawers", async () => {
  setupCopies(); mount("/admin/catalog?tab=holdings");
  fireEvent.click((await screen.findAllByRole("button",{name:"Book One"}))[1]);
  await screen.findByLabelText(/Accession number/);
  fireEvent.click(screen.getByRole("button",{name:"Edit record details"}));
  await screen.findByRole("tab",{name:"Details"});
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByTestId("route").textContent).toBe("?tab=holdings");
});
it("starts accession preparation on the first active non-voided incomplete copy", async () => {
  setupCopies([copy(1,{is_active:0}),copy(2,{accession_voided:1}),copy(3),copy(4)]);
  mount();fireEvent.click(await screen.findByRole("button",{name:"Add accession number"}));
  await screen.findByLabelText(/Accession number/);
  expect(screen.getByRole("button",{name:/^Copy 3 /}).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button",{name:/^Copy 1 /}).getAttribute("aria-expanded")).toBe("false");
  fireEvent.change(screen.getByLabelText(/Accession number/),{target:{value:"ACC-3"}});
  fireEvent.click(screen.getByRole("button",{name:"Save and next"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:/^Copy 4 /}).getAttribute("aria-expanded")).toBe("true"));
  expect(api.saveCopyHolding).toHaveBeenCalledTimes(1);
});
it("opens Add copies for a zero-copy record and selects the newly added copy", async () => {
  vi.mocked(api.fetchBookHoldings).mockResolvedValue([]);
  vi.mocked(api.addCatalogCopies).mockImplementation(async()=>{
    vi.mocked(api.fetchBookHoldings).mockResolvedValue([copy(1)]);
    return {message:"Added",copies:1};
  });
  mount();fireEvent.click(await screen.findByRole("button",{name:"Add accession number"}));
  const add=within(await screen.findByRole("dialog",{name:"Add copies"}));
  fireEvent.click(add.getByRole("button",{name:"Add copies"}));
  await screen.findByLabelText(/Accession number/);
  expect(api.addCatalogCopies).toHaveBeenCalledWith(1,1);
  expect(screen.getByRole("button",{name:/^Copy 1 /}).getAttribute("aria-expanded")).toBe("true");
});
it("preserves the record draft while navigating its Copies tab", async () => {
  setupCopies();mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));
  fireEvent.change(screen.getByLabelText(/^Title/),{target:{value:"Record draft"}});
  fireEvent.mouseDown(screen.getByRole("tab",{name:"Copies"}),{button:0,ctrlKey:false});
  fireEvent.click((await screen.findAllByRole("button",{name:"Add accession number"}))[0]);
  await screen.findByLabelText(/Accession number/);
  fireEvent.click(screen.getByRole("button",{name:"Next"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:/^Copy 2 /}).getAttribute("aria-expanded")).toBe("true"));
  fireEvent.mouseDown(screen.getByRole("tab",{name:"Details"}),{button:0,ctrlKey:false});
  expect(((await screen.findByLabelText(/^Title/)) as HTMLInputElement).value).toBe("Record draft");
});
it("keeps conflicting actions disabled throughout a save", async () => {
  setupCopies();let resolveSave!:()=>void;
  vi.mocked(api.saveCopyHolding).mockImplementation(()=>new Promise<void>(resolve=>{resolveSave=resolve;}));
  mount("/admin/catalog?tab=holdings");fireEvent.click((await screen.findAllByRole("button",{name:"Book One"}))[0]);
  const drawer=within(screen.getByRole("dialog"));
  fireEvent.change(await drawer.findByLabelText(/Accession number/),{target:{value:"ACC-1"}});
  fireEvent.click(drawer.getByRole("button",{name:"Save holding"}));
  await waitFor(()=>expect(drawer.getByRole("button",{name:"Next"}).hasAttribute("disabled")).toBe(true));
  expect(drawer.getByRole("button",{name:"Edit record details"}).hasAttribute("disabled")).toBe(true);
  expect(drawer.getByRole("button",{name:"Close copy"}).hasAttribute("disabled")).toBe(true);
  fireEvent.click(drawer.getByRole("button",{name:"Close"}));
  expect(screen.getByRole("dialog")).toBeTruthy();resolveSave();
  await waitFor(()=>expect(drawer.getByRole("button",{name:"Next"}).hasAttribute("disabled")).toBe(false));
});
it("checks both record and copy drafts before following an editor link", async () => {
  setupCopies();mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));
  fireEvent.change(screen.getByLabelText(/^Title/),{target:{value:"Record draft"}});
  fireEvent.mouseDown(screen.getByRole("tab",{name:"Copies"}),{button:0,ctrlKey:false});
  fireEvent.click((await screen.findAllByRole("button",{name:"Add accession number"}))[0]);
  fireEvent.change(await screen.findByLabelText(/Accession number/),{target:{value:"COPY-DRAFT"}});
  fireEvent.click(screen.getByRole("link",{name:"Manage programs / courses"}));
  fireEvent.click(await screen.findByRole("button",{name:"Discard changes"}));
  await screen.findByRole("alertdialog");
  fireEvent.click(await screen.findByRole("button",{name:"Keep editing"}));
  await waitFor(()=>expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByTestId("route").textContent).toBe("");
  expect((screen.getByLabelText(/Accession number/) as HTMLInputElement).value).toBe("COPY-DRAFT");
});
it("shows a retry action when an exact copy cannot load", async () => {
  setupCopies();vi.mocked(api.fetchBookHoldings).mockRejectedValue(new Error("Unavailable"));
  mount("/admin/catalog?tab=holdings");fireEvent.click((await screen.findAllByRole("button",{name:"Book One"}))[0]);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Try again"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Save holding"})).toBeNull();
  expect(screen.getByRole("button",{name:"Next"}).hasAttribute("disabled")).toBe(false);
});
it("uses live counted filters, URL state and one holdings action",async()=>{mount();await screen.findByRole("button",{name:"Needs holdings 1"});expect(screen.queryByRole("button",{name:"Search"})).toBeNull();expect(screen.getByRole("button",{name:"Add accession number"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Needs holdings 1"}));await waitFor(()=>expect(api.searchCatalogBooks).toHaveBeenLastCalledWith(expect.objectContaining({holdingStatus:"needs",status:"active"}),expect.any(AbortSignal)));expect(screen.getByTestId("route").textContent).toContain("filter=needs-holdings");});
it("groups Details, keeps the copy count read-only and hides additional contributor links",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));const drawer=within(screen.getByRole("dialog"));expect(drawer.getByRole("tab",{name:"Copies"})).toBeTruthy();expect(drawer.getByRole("region",{name:"Core"})).toBeTruthy();expect(drawer.getByRole("region",{name:"Description"})).toBeTruthy();expect(drawer.queryByRole("spinbutton",{name:"Copies"})).toBeNull();expect(drawer.getByText("2 physical copies")).toBeTruthy();expect(drawer.getByRole("button",{name:"Additional contributors (0)"}).getAttribute("aria-expanded")).toBe("false");expect(drawer.queryByText("Add Editor")).toBeNull();fireEvent.click(drawer.getByRole("button",{name:"Additional contributors (0)"}));expect(drawer.getByText("Add Editor")).toBeTruthy();});
it("saves metadata without changing the physical inventory count",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));fireEvent.change(screen.getByLabelText("Author",{exact:false}),{target:{value:"Updated author"}});expect(screen.getByText("Unsaved changes")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Save changes"}));await waitFor(()=>expect(api.updateCatalogBook).toHaveBeenCalled());const payload=vi.mocked(api.updateCatalogBook).mock.calls[0][1];expect(payload.author).toBe("Updated author");expect(payload).not.toHaveProperty("copies");});
it("preserves unsaved edits when closing is cancelled",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));fireEvent.change(screen.getByLabelText(/^Title/),{target:{value:"Updated title"}});fireEvent.click(screen.getByRole("button",{name:"Close"}));await screen.findByRole("alertdialog");fireEvent.click(screen.getByRole("button",{name:"Keep editing"}));expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe("Updated title");expect(api.updateCatalogBook).not.toHaveBeenCalled();});
it("blocks archive when a record has active loans or reservations",async()=>{vi.mocked(api.searchCatalogBooks).mockResolvedValue({rows:[{...book,active_loans:1,active_reservations:1}],pagination:{page:1,limit:25,total:1,totalPages:1}});mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));await waitFor(()=>expect(screen.getByRole("button",{name:"Archive record"}).hasAttribute("disabled")).toBe(true));expect(api.archiveCatalogBook).not.toHaveBeenCalled();});
it("previews CSV and never creates records before confirmation",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Import"}));const file=new File([""],"catalog.csv",{type:"text/csv"});Object.defineProperty(file,"text",{value:async()=>"title,author,book_type_id,copies\nNew Book,Writer,1,0"});fireEvent.change(screen.getByLabelText("Choose CSV"),{target:{files:[file]}});await screen.findByText("Row 2: New Book");expect(api.createCatalogBook).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Import 1 records"}));await waitFor(()=>expect(api.createCatalogBook).toHaveBeenCalledWith(expect.objectContaining({title:"New Book",book_type_id:"1",copies:"0"})));expect(await screen.findByText("Imported")).toBeTruthy();});

it("uses counted holdings filters, hides empty columns and exposes selected-copy actions",async()=>{vi.mocked(api.fetchCatalogHoldings).mockResolvedValue({rows:[{copy_id:9,book_id:1,title:"Book One",barcode:"COPY-9",condition:"good",is_active:1,accession_number:null,price:null,program_id:null,course:null,course_code:null,location:null,date_acquired:null,distributor:null,invoice_reference:null,circulation_status:"available"}],total:1,page:1,limit:25,pagination:{page:1,limit:25,total:1,totalPages:1},summary:{needs:1,available:0,borrowed:0,reserved:0,voided:0,all:1}});mount();fireEvent.mouseDown(await screen.findByRole("tab",{name:"Holdings"}),{button:0,ctrlKey:false});await screen.findByRole("button",{name:"Needs accession 1"});expect(screen.queryByRole("columnheader",{name:"Location"})).toBeNull();expect(screen.queryByRole("columnheader",{name:"Course"})).toBeNull();expect(screen.getByRole("button",{name:"Add accession number"})).toBeTruthy();fireEvent.click(screen.getByRole("checkbox",{name:"Select COPY-9"}));expect(screen.getByRole("region",{name:"Selected copies"})).toBeTruthy();expect(screen.getByRole("button",{name:"Print labels"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Needs accession 1"}));await waitFor(()=>expect(api.fetchCatalogHoldings).toHaveBeenLastCalledWith(expect.objectContaining({completion:"missing",status:"all"}),expect.any(AbortSignal)));},15000);
it("shows a sticky record bulk bar and requires confirmation before archive",async()=>{mount();fireEvent.click(await screen.findByRole("checkbox",{name:"Select Book One"}));const bar=within(screen.getByRole("region",{name:"Selected records"}));expect(bar.getByRole("button",{name:"Add accession number"})).toBeTruthy();fireEvent.click(bar.getByRole("button",{name:"Archive"}));await screen.findByRole("alertdialog");expect(api.archiveCatalogBook).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(api.archiveCatalogBook).not.toHaveBeenCalled();});

it("keeps inventory and accession editing inside Copies without a Holdings detour",async()=>{vi.mocked(api.fetchBookHoldings).mockResolvedValue([{copy_id:9,book_id:1,title:"Book One",barcode:"COPY-9",condition:"good",is_active:1,accession_number:null,price:null,program_id:null,course:null,course_code:null,location:null,date_acquired:null,distributor:null,invoice_reference:null,circulation_status:"available"}]);mount();fireEvent.click(await screen.findByRole("button",{name:"Book One"}));const drawer=within(screen.getByRole("dialog"));expect(drawer.queryByRole("tab",{name:"Holdings"})).toBeNull();fireEvent.click(drawer.getByRole("button",{name:"Manage copies"}));await drawer.findByRole("button",{name:"Add accession number"});expect(drawer.getByRole("button",{name:"Add copy"})).toBeTruthy();fireEvent.click(drawer.getByRole("button",{name:"Add copy"}));const addDialog=within(await screen.findByRole("dialog",{name:"Add copies"}));expect(api.addCatalogCopies).not.toHaveBeenCalled();fireEvent.click(addDialog.getByRole("button",{name:"Cancel"}));fireEvent.click(drawer.getByRole("button",{name:"Add accession number"}));await drawer.findByLabelText(/Accession number/);fireEvent.change(drawer.getByLabelText(/Accession number/),{target:{value:"ACC-9"}});fireEvent.click(drawer.getByRole("button",{name:/^Copy 9 /}));await screen.findByRole("alertdialog");fireEvent.click(screen.getByRole("button",{name:"Discard changes"}));await drawer.findByRole("button",{name:"Add copy"});expect(drawer.queryByRole("button",{name:"View in Holdings"})).toBeNull();expect(screen.getByTestId("route").textContent).toBe("");},15000);
it("changes a copy condition directly from Holdings without opening a drawer",async()=>{
 setupCopies([copy(1)]);
 vi.mocked(api.updateCatalogCopyCondition).mockResolvedValue(undefined);
 mount("/admin/catalog?tab=holdings");
 fireEvent.keyDown(await screen.findByRole("combobox",{name:"Condition of LIB-000001-001"}),{key:"ArrowDown"});
 fireEvent.click(await screen.findByRole("option",{name:"Weeded"}));
 await waitFor(()=>expect(api.updateCatalogCopyCondition).toHaveBeenCalledWith(1,"weeded"));
 expect(screen.queryByRole("dialog")).toBeNull();
 await screen.findByText("Condition updated for LIB-000001-001.");
});
