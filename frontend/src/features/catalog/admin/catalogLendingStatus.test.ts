import { describe, expect, it } from "vitest";
import { getCatalogLendingStatus } from "./catalogLendingStatus";

describe("getCatalogLendingStatus", () => {
  it("shows available copies and calls out copies that still need holdings", () => {
    expect(getCatalogLendingStatus({ available: 1, accessioned_copies: 1, unaccessioned_copies: 1, total_copies: 2 })).toEqual({
      label: "1 available to borrow",
      detail: "1 accessioned copy · 1 copy needs accession · 2 total copies",
      tone: "available",
      needsHoldings: true,
    });
  });

  it("explains when all accessioned copies are in use", () => {
    expect(getCatalogLendingStatus({ available: 0, accessioned_copies: 2, unaccessioned_copies: 1, total_copies: 4 })).toEqual({
      label: "No copies available now",
      detail: "2 accessioned copies in use · 1 copy needs accession · 1 copy not lendable",
      tone: "unavailable",
      needsHoldings: true,
    });
  });

  it("offers holdings when active eligible copies lack accession numbers", () => {
    expect(getCatalogLendingStatus({ available: 0, accessioned_copies: 0, unaccessioned_copies: 1, total_copies: 1 })).toEqual({
      label: "Needs accession number",
      detail: "1 copy needs holdings",
      tone: "unavailable",
      needsHoldings: true,
    });
  });

  it("distinguishes inactive or otherwise ineligible physical copies", () => {
    expect(getCatalogLendingStatus({ available: 0, accessioned_copies: 0, unaccessioned_copies: 0, total_copies: 2 })).toEqual({
      label: "No lendable copies",
      detail: "2 copies recorded · none meet lending rules",
      tone: "unavailable",
      needsHoldings: false,
    });
  });

  it("handles books with no physical copies", () => {
    expect(getCatalogLendingStatus({ available: 0, accessioned_copies: 0, unaccessioned_copies: 0, total_copies: 0 })).toEqual({
      label: "No lendable copies",
      detail: "No physical copies recorded",
      tone: "unavailable",
      needsHoldings: false,
    });
  });

  it("does not offer Add holdings when every active accession is permanently voided", () => {
    expect(getCatalogLendingStatus({ available: 0, accessioned_copies: 0, unaccessioned_copies: 1, voided_copies: 1, total_copies: 1 })).toEqual({
      label: "No lendable copies",
      detail: "1 copy with voided accessions · add a new physical copy to use another number",
      tone: "unavailable",
      needsHoldings: false,
    });
  });
});
