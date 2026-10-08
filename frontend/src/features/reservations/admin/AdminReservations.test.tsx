// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, cleanup, within, configure } from "@testing-library/react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryRouter } from "react-router-dom";

import { createTestQueryClient, createTestQueryClientWrapper } from "@/test-utils/query-client";

configure({ asyncUtilTimeout: 5000 });

const api = vi.hoisted(() => ({ getAdminReservations:vi.fn(), markReservationReady:vi.fn(), cancelReservationAdmin:vi.fn(), archiveReservation:vi.fn(), restoreReservation:vi.fn() }));

vi.mock("./reservations.api", () => api);

vi.mock("@/components/ui/sonner", () => ({toast:{success:vi.fn(),error:vi.fn(),info:vi.fn()}}));

import AdminReservations, { reservationTiming } from "./AdminReservations";

import type { AdminReservation } from "./reservations.types";

const row = (id:number, status:AdminReservation["status"]):AdminReservation => ({id,book_id:id,user_name:`Patron ${id}`,student_employee_id:`ID-${id}`,book_title:`Book ${id}`,book_author:"Author",book_location:null,status,reserved_at:"2026-10-01T08:00:00Z",expires_at:status==="ready"?"2026-10-10T08:00:00Z":null,notes:null,available_copies:1,queue_position:1});

const summary={total_records:4,pending_count:2,ready_count:1,fulfilled_count:1,cancelled_count:0,expired_count:0,expiring_count:0,soonest_expiry:"2026-10-10T08:00:00Z"};

function mount(entry="/admin/reservations") { const Wrapper=createTestQueryClientWrapper(createTestQueryClient());return render(<Wrapper><MemoryRouter initialEntries={[entry]}><AdminReservations /></MemoryRouter></Wrapper>); }

beforeEach(()=>{vi.resetAllMocks();api.getAdminReservations.mockImplementation(async filters=>({rows:filters.status==="ready"?[row(1,"ready")]:[row(1,"ready"),row(2,"pending"),row(3,"pending")],total:filters.status==="ready"?1:3,page:1,totalPages:1,summary}));});

afterEach(cleanup);

describe("reservation work queue",()=>{
  it("blocks preparation with no copy while keeping cancellation and details available", async () => {
    api.getAdminReservations.mockResolvedValue({ rows: [{ ...row(2, "pending"), available_copies: 0, queue_position: 2 }], total: 1, page: 1, totalPages: 1, summary });
    mount();
    const mark = await screen.findByRole("button", { name: "Mark ready" });
    expect((mark as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("No copy available · Queue #2")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select reservation 2 for Patron 2" }));
    const bulk = screen.getByRole("region", { name: "Selected reservations" });
    expect(within(bulk).getByText("1 selected")).toBeTruthy();
    expect((within(bulk).getByRole("button", { name: "Mark ready" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Reserved Oct 1, 2026").closest("li")!);
    expect(within(screen.getByRole("dialog")).getByRole("region", { name: "Request history" })).toBeTruthy();
    expect(api.markReservationReady).not.toHaveBeenCalled();
  });
  it("keeps closed work collapsed with an archive action in its header", async () => {
    mount();
    await screen.findByRole("button", { name: "Process pickup" });
    const archive = screen.getByRole("button", { name: "Archive all closed…" });
    expect(archive.closest("summary")).toBeTruthy();
    expect(archive.closest("details")?.open).toBe(false);
    expect(within(screen.getByRole("group", { name: "Reservation status" })).getAllByRole("button").map(item => item.textContent)).toEqual(["Needs action3", "Closed1", "All4"]);
  });
  it("offers details and reason-protected cancellation in the live-row menu", async () => {
    mount();
    const menu = await screen.findByRole("button", { name: "Actions for Book 2, 2" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(await screen.findByRole("menuitem", { name: "View details" })).toBeTruthy();
    const cancel = screen.getByRole("menuitem", { name: "Cancel reservation…" });
    expect(cancel.className).toContain("text-destructive");
    expect(screen.queryByRole("menuitem", { name: "Archive reservation…" })).toBeNull();
    fireEvent.click(cancel);
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByRole("button", { name: "Cancel reservation" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.cancelReservationAdmin).not.toHaveBeenCalled();
  });

  it("defaults to live work and retains global counts when selecting Ready",async()=>{mount();await screen.findByRole("button",{name:"Process pickup"});expect(api.getAdminReservations.mock.calls[0][0].status).toBe("needs_action");expect(screen.getByRole("button",{name:"Needs action 3"}).getAttribute("aria-pressed")).toBe("true");expect(screen.getAllByText(/Reserved Oct 1/)).toHaveLength(3);expect(screen.queryByText("Book 4")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Ready for pickup: 1"}));await waitFor(()=>expect(api.getAdminReservations).toHaveBeenLastCalledWith(expect.objectContaining({status:"ready"}),expect.anything()));expect(screen.getByRole("button",{name:"Pending to prepare: 2"})).toBeTruthy();});

  it("requires a reason before cancellation and submits it to the API",async()=>{mount();await screen.findByRole("button",{name:"Process pickup"});fireEvent.click(screen.getByRole("checkbox",{name:"Select reservation 2 for Patron 2"}));fireEvent.click(screen.getByRole("button",{name:"Cancel…"}));const dialog=screen.getByRole("dialog");const confirm=within(dialog).getByRole("button",{name:"Cancel reservation"});expect((confirm as HTMLButtonElement).disabled).toBe(true);expect(api.cancelReservationAdmin).not.toHaveBeenCalled();fireEvent.change(within(dialog).getByLabelText("Cancellation reason"),{target:{value:"Patron requested cancellation"}});fireEvent.click(confirm);await waitFor(()=>expect(api.cancelReservationAdmin).toHaveBeenCalledWith(2,"Patron requested cancellation"));});

  it("shows a meaningful empty state and never invents zeros on initial failure",async()=>{api.getAdminReservations.mockResolvedValue({rows:[],total:0,page:1,totalPages:0,summary:{...summary,total_records:0,pending_count:0,ready_count:0,fulfilled_count:0,soonest_expiry:null}});const view=mount();await screen.findByRole("heading",{name:"All caught up"});view.unmount();api.getAdminReservations.mockRejectedValue(new Error("offline"));mount();await screen.findByRole("alert");expect(screen.queryByRole("heading",{name:"All caught up"})).toBeNull();expect(screen.getByRole("button",{name:"Ready for pickup: unavailable"})).toBeTruthy();});

  it("signals expiry urgency at the six and 24 hour boundaries",()=>{const ready=row(1,"ready");const deadline=new Date(ready.expires_at!).getTime();expect(reservationTiming(ready,deadline-5*3600000)).toEqual({text:"Expires in 5 hours",tone:"red"});expect(reservationTiming(ready,deadline-20*3600000).tone).toBe("amber");expect(reservationTiming(ready,deadline+1).text).toBe("Pickup window ended");});
  it("keeps recent requests neutral and warns on week-old requests", () => {
    const pending = row(2, "pending");
    const request = new Date(pending.reserved_at).getTime();
    expect(reservationTiming(pending, request + 2 * 86400000).tone).toBe("neutral");
    expect(reservationTiming(pending, request + 32 * 86400000)).toEqual({ text: "Waiting 32 days", tone: "amber" });
  });

});

