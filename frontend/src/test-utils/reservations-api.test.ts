import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/utils/AxiosInstance", () => ({
  default: { get, post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import { getAdminReservations } from "@/features/reservations";

describe("getAdminReservations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the TanStack Query abort signal through to Axios", async () => {
    const result = { rows: [], total: 0, page: 1, totalPages: 1 };
    const controller = new AbortController();
    get.mockResolvedValue({ data: result });

    await expect(getAdminReservations({ page: 1, limit: 15 }, controller.signal)).resolves.toEqual(result);
    expect(get).toHaveBeenCalledWith("/api/admin/reservations", {
      params: { page: 1, limit: 15 },
      signal: controller.signal,
    });
  });
});
