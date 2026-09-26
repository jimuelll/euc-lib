import { describe, expect, it } from "vitest";
import { queryKeys } from "./query.keys";

describe("reporting query keys", () => {
  it("creates separate keys for each dataset and applied filter set", () => {
    const base = { dataset: "catalog" as const, page: 1, limit: 25 };
    expect(queryKeys.records(base)).not.toEqual(queryKeys.records({ ...base, page: 2 }));
    expect(queryKeys.records(base)).not.toEqual(queryKeys.records({ ...base, search: "title" }));
    expect(queryKeys.records(base)).not.toEqual(queryKeys.records({ ...base, status: "ready" }));
    expect(queryKeys.records(base)).not.toEqual(queryKeys.records({ ...base, archived: 1 }));
    expect(queryKeys.records(base)).not.toEqual(queryKeys.records({ ...base, dataset: "users" }));
  });

  it("normalizes empty and default filter values for cache reuse", () => {
    expect(queryKeys.records({ dataset: "catalog", search: "", status: "all" })).toEqual(
      queryKeys.records({ status: "all", dataset: "catalog" }),
    );
    expect(queryKeys.records({ dataset: "catalog", search: "  title  " })).toEqual(
      queryKeys.records({ dataset: "catalog", search: "title" }),
    );
  });

  it("keeps preview and report data in distinct namespaces", () => {
    const filters = { dataset: "catalog" as const, page: 1 };
    expect(queryKeys.recordPreview(filters)).not.toEqual(queryKeys.records(filters));
    expect(queryKeys.reportPreview({ report: "fined" })).not.toEqual(queryKeys.reports({ report: "fined" }));
  });
});
