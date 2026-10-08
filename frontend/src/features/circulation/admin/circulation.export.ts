import { getCirculationLog, type CirculationLogEntry, type CirculationLogFilters } from "./circulation.api";

export async function fetchCirculationExport(filters: CirculationLogFilters, signal?: AbortSignal) {
  const records = new Map<number, CirculationLogEntry>();
  for (let page = 1; ; page++) {
    const result = await getCirculationLog({ ...filters, page, limit: 50 }, signal);
    result.rows.forEach(row => records.set(row.id, row));
    if (page >= result.totalPages) break;
  }
  return [...records.values()];
}
export function circulationCsv(rows: CirculationLogEntry[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    // CSV is data, including when opened in spreadsheet applications.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [["Patron", "ID", "Book", "ISBN", "Copy", "Borrowed", "Due", "Returned", "Status", "Fine", "Issued by"], ...rows.map(row => [row.user_name, row.student_employee_id, row.book_title, row.isbn, row.copy_barcode, row.borrowed_at, row.due_date, row.returned_at, row.status, row.fine_amount, row.issued_by_name])].map(row => row.map(cell).join(",")).join("\r\n");
}
