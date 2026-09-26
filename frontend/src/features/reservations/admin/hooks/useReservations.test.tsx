// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, createTestQueryClientWrapper } from "@/test-utils/query-client";
import type { AdminReservation, ReservationsResult } from "../reservations.types";

const { api, confirm, toast } = vi.hoisted(() => ({
  api: {
    getAdminReservations: vi.fn(),
    markReservationReady: vi.fn(),
    cancelReservationAdmin: vi.fn(),
    archiveReservation: vi.fn(),
    restoreReservation: vi.fn(),
  },
  confirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../reservations.api", () => api);
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/features/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin")>()),
  useAdminConfirmDialog: () => ({ confirm, confirmDialog: null }),
}));

import { useReservations } from "./useReservations";

const reservation = (id = 1): AdminReservation => ({
  id,
  book_id: 10,
  user_name: "Test Patron",
  student_employee_id: "TEST-1",
  book_title: `Book ${id}`,
  book_author: "Test Author",
  book_location: "Stacks",
  status: "pending",
  reserved_at: "2026-09-01T09:00:00.000Z",
  expires_at: null,
  notes: null,
});

const resultFor = (rows: AdminReservation[]): ReservationsResult => ({
  rows,
  total: rows.length,
  page: 1,
  totalPages: 1,
});

function createWrapper(entry = "/admin/reservations") {
  const client = createTestQueryClient();
  const QueryWrapper = createTestQueryClientWrapper(client);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryWrapper>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryWrapper>
  );
  return { client, Wrapper };
}

beforeEach(() => {
  vi.resetAllMocks();
  confirm.mockResolvedValue(true);
  api.getAdminReservations.mockResolvedValue(resultFor([reservation()]));
  api.markReservationReady.mockResolvedValue(reservation());
  api.cancelReservationAdmin.mockResolvedValue(reservation());
  api.archiveReservation.mockResolvedValue(undefined);
  api.restoreReservation.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("useReservations query state", () => {
  it("loads reservations and retries manually after a failed request", async () => {
    api.getAdminReservations
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(resultFor([reservation()]));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReservations(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBe("Reservations could not be loaded. Try again."));
    expect(result.current.initialLoading).toBe(false);
    await act(async () => { await result.current.fetchReservations(); });

    await waitFor(() => {
      expect(result.current.error).toBe("");
      expect(result.current.data?.rows).toHaveLength(1);
    });
    expect(api.getAdminReservations).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous page visible while a filter query is loading", async () => {
    let resolveFiltered!: (value: ReservationsResult) => void;
    api.getAdminReservations
      .mockResolvedValueOnce(resultFor([reservation(1)]))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFiltered = resolve; }));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReservations(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.rows[0]?.id).toBe(1));
    act(() => result.current.handleStatusChange("ready"));
    await waitFor(() => expect(api.getAdminReservations).toHaveBeenCalledTimes(2));

    expect(result.current.data?.rows[0]?.id).toBe(1);
    expect(result.current.loading).toBe(true);
    expect(result.current.initialLoading).toBe(false);
    expect(api.getAdminReservations.mock.calls[1][0]).toEqual({ page: 1, limit: 15, status: "ready" });

    await act(async () => { resolveFiltered(resultFor([reservation(2)])); });
    await waitFor(() => expect(result.current.data?.rows[0]?.id).toBe(2));
  });

  it("aborts an in-flight request when the last observer unmounts", async () => {
    api.getAdminReservations.mockImplementation(() => new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { unmount } = renderHook(() => useReservations(), { wrapper: Wrapper });
    await waitFor(() => expect(api.getAdminReservations).toHaveBeenCalledTimes(1));
    const signal = api.getAdminReservations.mock.calls[0][1] as AbortSignal;

    unmount();
    await waitFor(() => expect(signal.aborted).toBe(true));
  });
});

describe("useReservations mutations", () => {
  it.each([
    ["mark ready", "handleMarkReady", "markReservationReady", '"Book 1" marked as ready for pickup'],
    ["cancel", "handleCancel", "cancelReservationAdmin", 'Reservation for "Book 1" cancelled'],
    ["archive", "handleArchive", "archiveReservation", "Reservation archived"],
    ["restore", "handleRestore", "restoreReservation", "Reservation restored"],
  ] as const)("invalidates reservation lists after %s succeeds", async (_label, handlerName, apiName, message) => {
    api.getAdminReservations
      .mockResolvedValueOnce(resultFor([reservation()]))
      .mockResolvedValueOnce(resultFor([]));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReservations(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1));

    await act(async () => {
      await result.current[handlerName](1, "Book 1");
    });

    expect(api[apiName]).toHaveBeenCalledWith(1);
    await waitFor(() => expect(api.getAdminReservations).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith(message);
    expect(result.current.actionId).toBeNull();
  });

  it.each([
    ["mark ready", "handleMarkReady", "markReservationReady"],
    ["cancel", "handleCancel", "cancelReservationAdmin"],
  ] as const)("shows the pending row and server error for a failed %s action", async (_label, handlerName, apiName) => {
    let rejectMutation!: (error: Error) => void;
    api[apiName].mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectMutation = reject; }));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReservations(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1));

    let action!: Promise<void>;
    act(() => { action = result.current[handlerName](1, "Book 1"); });
    await waitFor(() => expect(api[apiName]).toHaveBeenCalledWith(1));
    expect(result.current.actionId).toBe(1);

    await act(async () => {
      rejectMutation(Object.assign(new Error("denied"), {
        response: { data: { message: "Permission denied" } },
      }));
      await action;
    });

    expect(toast.error).toHaveBeenCalledWith("Permission denied");
    expect(result.current.actionId).toBeNull();
    expect(api.getAdminReservations).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["archive", "archiveReservation", "handleArchive", "Failed to archive reservation"],
    ["restore", "restoreReservation", "handleRestore", "Failed to restore reservation"],
  ] as const)("optimistically removes a reservation and rolls back a failed %s", async (_label, apiName, handlerName, fallback) => {
    let rejectMutation!: (error: Error) => void;
    api[apiName].mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectMutation = reject; }));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useReservations(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1));

    let action!: Promise<void>;
    act(() => { action = result.current[handlerName](1, "Book 1"); });
    await waitFor(() => expect(api[apiName]).toHaveBeenCalledWith(1));
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(0));
    expect(result.current.actionId).toBe(1);

    await act(async () => {
      rejectMutation(new Error("request failed"));
      await action;
    });

    expect(result.current.data?.rows).toHaveLength(1);
    expect(result.current.actionId).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(fallback);
  });
});
