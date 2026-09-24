import type { Book } from "./AdminCatalog.types";

type LendingStatusBook = Pick<Book, "available" | "accessioned_copies" | "unaccessioned_copies" | "voided_copies" | "total_copies" | "copies">;

export type CatalogLendingStatus = {
  label: string;
  detail: string;
  tone: "available" | "unavailable";
  needsHoldings: boolean;
};

const count = (value: number | undefined, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const copies = (value: number) => `${value} ${value === 1 ? "copy" : "copies"}`;
const accessionedCopies = (value: number) => `${value} accessioned ${value === 1 ? "copy" : "copies"}`;
const needsAccession = (value: number) => `${copies(value)} ${value === 1 ? "needs" : "need"} accession`;
const totalCopies = (value: number) => `${value} total ${value === 1 ? "copy" : "copies"}`;

export function getCatalogLendingStatus(book: LendingStatusBook): CatalogLendingStatus {
  const available = count(book.available);
  const accessioned = count(book.accessioned_copies);
  const unaccessioned = count(book.unaccessioned_copies);
  const voided = count(book.voided_copies);
  const needsNewAccession = Math.max(0, unaccessioned - voided);
  const total = count(book.total_copies, count(book.copies));
  const other = Math.max(0, total - accessioned - unaccessioned);

  if (available > 0) {
    const details = [accessionedCopies(accessioned)];
    if (needsNewAccession > 0) details.push(needsAccession(needsNewAccession));
    if (voided > 0) details.push(`${copies(voided)} with voided accessions`);
    if (other > 0) details.push(`${copies(other)} not lendable`);
    details.push(totalCopies(total));
    return {
      label: `${available} available to borrow`,
      detail: details.join(" · "),
      tone: "available",
      needsHoldings: needsNewAccession > 0,
    };
  }

  if (accessioned > 0) {
    const details = [`${accessionedCopies(accessioned)} in use`];
    if (needsNewAccession > 0) details.push(needsAccession(needsNewAccession));
    if (voided > 0) details.push(`${copies(voided)} with voided accessions`);
    if (other > 0) details.push(`${copies(other)} not lendable`);
    return {
      label: "No copies available now",
      detail: details.join(" · "),
      tone: "unavailable",
      needsHoldings: needsNewAccession > 0,
    };
  }

  if (needsNewAccession > 0) {
    const details = [`${copies(needsNewAccession)} ${needsNewAccession === 1 ? "needs" : "need"} holdings`];
    if (voided > 0) details.push(`${copies(voided)} with voided accessions`);
    if (other > 0) details.push(`${other} not lendable`);
    return {
      label: "Needs accession number",
      detail: details.join(" · "),
      tone: "unavailable",
      needsHoldings: true,
    };
  }

  if (voided > 0) {
    return {
      label: "No lendable copies",
      detail: `${copies(voided)} with voided accessions · add a new physical copy to use another number`,
      tone: "unavailable",
      needsHoldings: false,
    };
  }

  return {
    label: "No lendable copies",
    detail: total > 0 ? `${copies(total)} recorded · none meet lending rules` : "No physical copies recorded",
    tone: "unavailable",
    needsHoldings: false,
  };
}
