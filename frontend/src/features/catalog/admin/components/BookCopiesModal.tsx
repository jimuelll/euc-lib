import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine, Loader2, Download, Printer, BookOpen, Archive, ArchiveRestore } from "lucide-react";
import { printCodeLabel } from "@/utils/printCodeLabel";
import { fetchCatalogBarcode, fetchCatalogBookCopies, fetchCatalogCopy, updateCatalogCopyCondition, retireCatalogCopy, restoreCatalogCopy } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { getApiErrorMessage } from "@/utils/apiError";

type Copy = {
  id: number;
  barcode: string;
  accession_number?: string | null;
  accession_voided?: boolean | number;
  borrow_eligible?: boolean | number;
  needs_policy?: boolean | number;
  condition: "good" | "damaged" | "lost";
  is_active: number;
  status: "available" | "borrowed" | "reserved";
  due_date?: string;
  borrower_name?: string;
  notes?: string;
};

type Props = {
  bookId: number;
  bookTitle: string;
  onClose: () => void;
  embedded?: boolean;
};

const CONDITION_CONFIG: Record<string, { label: string; className: string }> = {
  good:    { label: "Good",    className: "border-success/30 text-success bg-success/5"           },
  damaged: { label: "Damaged", className: "border-warning/40 text-warning bg-warning/5"           },
  lost:    { label: "Lost",    className: "border-destructive/30 text-destructive bg-destructive/5" },
};

const STATUS_CONFIG = {
  available: { label: "Available", className: "border-success/30 text-success bg-success/5"           },
  borrowed:  { label: "Borrowed",  className: "border-destructive/30 text-destructive bg-destructive/5" },
  reserved:  { label: "Reserved",  className: "border-warning/40 text-warning bg-warning/5"           },
};

const fetchBarcodeObjectUrl = async (barcode: string): Promise<string> => {
  return fetchCatalogBarcode(barcode);
};

// ─── Badge ────────────────────────────────────────────────────────────────────

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 text-xs font-bold  ${className ?? ""}`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </span>
);

// ─── Detail row (scan result grid) ───────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <dt
      className="py-2 text-xs font-bold  text-muted-foreground border-b border-border/50"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </dt>
    <dd className="py-2 text-sm text-foreground border-b border-border/50">{value}</dd>
  </>
);

// ─── Main component ───────────────────────────────────────────────────────────

const BookCopiesModal = ({ bookId, bookTitle, onClose, embedded = false }: Props) => {
  const queryClient = useQueryClient();
  const copiesQuery = useQuery({ queryKey: catalogKeys.adminCopies(bookId), queryFn: ({ signal }) => fetchCatalogBookCopies(bookId, signal) });
  const copies: Copy[] = copiesQuery.data ?? [];
  const loading = copiesQuery.isPending;
  const [scanning, setScanning]       = useState(false);
  const [scannedCopy, setScannedCopy] = useState<(Copy & { title?: string; author?: string }) | null>(null);
  const [barcodeUrls, setBarcodeUrls] = useState<Record<string, string>>({});
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const invalidateCatalogData = () => queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  const conditionMutation = useMutation({ mutationFn: ({ copy, condition }: { copy: Copy; condition: Copy["condition"] }) => updateCatalogCopyCondition(copy.id, condition), onSuccess: invalidateCatalogData });
  const retireMutation = useMutation({ mutationFn: retireCatalogCopy, onSuccess: invalidateCatalogData });
  const restoreMutation = useMutation({ mutationFn: restoreCatalogCopy, onSuccess: invalidateCatalogData });
  const busyCopyId = conditionMutation.isPending ? conditionMutation.variables?.copy.id ?? null : retireMutation.isPending ? retireMutation.variables ?? null : restoreMutation.isPending ? restoreMutation.variables ?? null : null;

  useEffect(() => {
    if (!copies.length) return;
    copies.forEach(async (copy) => {
      if (barcodeUrls[copy.barcode]) return;
      try {
        const url = await fetchBarcodeObjectUrl(copy.barcode);
        setBarcodeUrls((prev) => ({ ...prev, [copy.barcode]: url }));
      } catch { /* silent */ }
    });
  }, [copies]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { Object.values(barcodeUrls).forEach(URL.revokeObjectURL); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const startScanner = useCallback(() => {
    setScannedCopy(null);
    setScanning(true);
  }, []);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (result) {
          const barcode = result.getText();
          stopScanner();
          try {
            const data = await queryClient.fetchQuery({ queryKey: catalogKeys.adminCopy(barcode), queryFn: ({ signal }) => fetchCatalogCopy(barcode, signal) });
            setScannedCopy(data);
            if (!barcodeUrls[barcode]) {
              const url = await fetchBarcodeObjectUrl(barcode);
              setBarcodeUrls((prev) => ({ ...prev, [barcode]: url }));
            }
          } catch { toast.error(`Copy not found: ${barcode}`); }
        }
        if (import.meta.env.DEV && err && err.name !== "NotFoundException") console.warn("[ZXing]", err.message);
      })
      .then((controls) => { controlsRef.current = controls; })
      .catch((e) => { toast.error("Camera error: " + e.message); stopScanner(); });
    return () => { controlsRef.current?.stop(); controlsRef.current = null; };
  }, [scanning, stopScanner, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = (barcode: string) => {
    const url = barcodeUrls[barcode];
    if (!url) { toast.error("Barcode not loaded yet"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `${barcode}.png`; a.click();
  };
  const handlePrint = (barcode: string) => {
    const url = barcodeUrls[barcode];
    if (!url) return toast.error("Barcode not loaded yet");
    if (!printCodeLabel({ imageUrl: url, title: bookTitle, code: barcode, kind: "Library book copy" })) toast.error("Allow pop-ups to print this label.");
  };
  const handleConditionChange = async (copy: Copy, condition: Copy["condition"]) => {
    try {
      await conditionMutation.mutateAsync({ copy, condition });
      if (scannedCopy?.id === copy.id) setScannedCopy({ ...scannedCopy, condition });
      toast.success("Copy condition updated");
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to update copy condition")); }
  };

  const handleRetire = async (copy: Copy) => {
    if (!window.confirm(`Retire ${copy.barcode}? Its barcode, holdings, and history will be kept, and it will no longer be available for lending.`)) return;
    try {
      await retireMutation.mutateAsync(copy.id);
      toast.success("Copy retired; its history and accession were kept");
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to retire copy")); }
  };

  const handleRestore = async (copy: Copy) => {
    try {
      const result = await restoreMutation.mutateAsync(copy.id);
      toast.success(result.lendingEligible ? "Copy restored and available for circulation checks" : "Copy restored; record its accession or update its condition before lending");
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, "Failed to restore copy")); }
  };

  const available = copies.filter((c) => c.status === "available" && c.is_active && Boolean(c.accession_number) && c.borrow_eligible !== false && c.borrow_eligible !== 0).length;
  const borrowed  = copies.filter((c) => c.status === "borrowed").length;
  const active = copies.filter((c) => Boolean(c.is_active)).length;
  const retired = copies.length - active;

  return (
    <div className={embedded ? "flex min-h-0 flex-1 flex-col" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"}>
      <div className={embedded ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-border bg-background" : "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-border bg-background shadow-2xl"}>

        {/* Gold top rule */}
        <div className="h-[3px] w-full bg-warning shrink-0" />

        {/* ── Modal header ──────────────────────────────────────────── */}
        <div className="bg-primary shrink-0">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <BookOpen className="h-4 w-4 text-primary-foreground/40 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p
                  className="text-xs font-bold  text-primary-foreground/45 mb-0.5"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Book Copies
                </p>
                <h3
                  className="text-[15px] font-bold text-primary-foreground leading-snug"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {bookTitle}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={scanning ? stopScanner : startScanner}
                className="flex items-center gap-1.5 border border-primary-foreground/30 px-3 py-1.5 text-xs font-bold  text-primary-foreground/70 hover:border-warning hover:text-warning transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <ScanLine className="h-3.5 w-3.5" />
                {scanning ? "Stop Scan" : "Scan"}
              </button>
              {!embedded && <button
                onClick={onClose}
                className="p-1.5 text-primary-foreground/40 hover:text-primary-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>}
            </div>
          </div>

          {/* Summary strip — available/borrowed counts */}
          {!loading && copies.length > 0 && (
            <div className="flex divide-x divide-primary-foreground/10 border-t border-primary-foreground/10">
              {[
                { label: "Active",    value: active         },
                { label: "Available", value: available     },
                { label: "Borrowed",  value: borrowed      },
                { label: "Retired",   value: retired       },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 px-5 py-2.5 text-center">
                  <p
                    className="text-xs font-bold  text-primary-foreground/40"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-0.5 text-lg font-bold text-primary-foreground leading-none"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">

          {/* Scanner view */}
          {scanning && (
            <div className="border-b border-border bg-black">
              <video ref={videoRef} className="w-full max-h-56 object-cover" />
              <p
                className="py-2 text-center text-xs font-bold  text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Point camera at a book barcode
              </p>
            </div>
          )}

          {/* Scan result */}
          {scannedCopy && (
            <div className="border-b border-border">
              <div className="flex items-center gap-2.5 px-5 py-2.5 bg-primary/5 border-b border-primary/15">
                <div className="h-px w-4 bg-warning shrink-0" />
                <p
                  className="text-xs font-bold  text-primary"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Scan Result
                </p>
              </div>
              <div className="flex gap-5 items-start p-5">
                {barcodeUrls[scannedCopy.barcode] && (
                  <img
                    src={barcodeUrls[scannedCopy.barcode]}
                    alt={scannedCopy.barcode}
                    className="h-16 w-auto border border-border bg-white p-1.5 shrink-0"
                  />
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 text-sm flex-1">
                  <DetailRow label="Barcode" value={<span className="font-mono text-sm">{scannedCopy.barcode}</span>} />
                  {scannedCopy.accession_number && <DetailRow label="Accession number" value={<span className="font-mono text-sm">{scannedCopy.accession_number}</span>} />}
                  {scannedCopy.title       && <DetailRow label="Book"     value={scannedCopy.title}        />}
                  <DetailRow label="Status" value={!scannedCopy.is_active ? "Inactive" : scannedCopy.accession_voided ? "Accession voided" : scannedCopy.status === "available" && scannedCopy.needs_policy ? "Needs loan policy" : scannedCopy.status === "available" && !scannedCopy.accession_number ? "Needs accession" : scannedCopy.status === "available" && !scannedCopy.borrow_eligible ? "Not lendable" : scannedCopy.status === "available" ? "Available to borrow" : scannedCopy.status} />
                  <DetailRow label="Condition" value={scannedCopy.condition} />
                  {scannedCopy.borrower_name && <DetailRow label="Borrower" value={scannedCopy.borrower_name} />}
                  {scannedCopy.due_date      && <DetailRow label="Due"      value={scannedCopy.due_date}      />}
                </dl>
              </div>
            </div>
          )}

          {/* ── Copies list ──────────────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
              <p
                className="text-xs  text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Loading copies…
              </p>
            </div>
          ) : copiesQuery.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-16 text-sm text-destructive">
              <p>{getApiErrorMessage(copiesQuery.error, "Failed to load copies")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copiesQuery.refetch()}>Try again</Button>
            </div>
          ) : copies.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <BookOpen className="h-8 w-8 text-muted-foreground/15" />
              <p
                className="text-xs  text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                No copies found
              </p>
            </div>
          ) : (
            <table className="admin-stack-copies w-full text-sm">
              {/* Table head */}
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/50">
                  {["#", "Copy / accession", "Status", "Condition", "Borrower / Notes", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left"
                    >
                      <span
                        className="text-xs font-bold  text-muted-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {h}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {copies.map((copy, i) => (
                  <tr
                    key={copy.id}
                    className={`hover:bg-muted/20 transition-colors ${!copy.is_active ? "opacity-40" : ""}`}
                  >
                    {/* Index */}
                    <td className="px-4 py-3 w-8">
                      <span
                        className="text-xs font-bold tracking-[0.1em] text-muted-foreground/30"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>

                    {/* Barcode and accession */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {barcodeUrls[copy.barcode] ? (
                          <img
                            src={barcodeUrls[copy.barcode]}
                            alt={copy.barcode}
                            className="h-10 w-auto border border-border bg-white p-1 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-20 shrink-0 border border-border bg-muted flex items-center justify-center">
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0"><span className="block font-mono text-xs text-foreground">{copy.barcode}</span><span className="mt-1 block text-xs text-muted-foreground">{copy.accession_number ? `Acc. ${copy.accession_number}` : "Needs accession"}</span></div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge className={copy.status === "available" && (!copy.is_active || !copy.accession_number || !copy.borrow_eligible) ? "border-warning/40 text-warning bg-warning/5" : STATUS_CONFIG[copy.status].className}>
                        {!copy.is_active ? "Retired" : copy.accession_voided ? "Accession voided" : copy.status === "available" && copy.needs_policy ? "Needs loan policy" : copy.status === "available" && !copy.accession_number ? "Needs accession" : copy.status === "available" && !copy.borrow_eligible ? "Not lendable" : copy.status === "available" ? "Available to borrow" : STATUS_CONFIG[copy.status].label}
                      </Badge>
                    </td>

                    {/* Condition */}
                    <td className="px-4 py-3">
                      <select aria-label={`Condition for ${copy.barcode}`} value={copy.condition} disabled={!copy.is_active || copy.status === "borrowed"} onChange={(event) => void handleConditionChange(copy, event.target.value as Copy["condition"])} className={`h-8 border px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CONDITION_CONFIG[copy.condition]?.className ?? "border-border"}`}>
                        <option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option>
                      </select>
                    </td>

                    {/* Borrower / notes */}
                    <td className="px-4 py-3 max-w-[180px]">
                      {copy.borrower_name ? (
                        <div>
                          <p className="text-sm font-medium text-foreground truncate">{copy.borrower_name}</p>
                          {copy.due_date && (
                            <p className="text-xs text-muted-foreground">Due {copy.due_date}</p>
                          )}
                        </div>
                      ) : copy.notes ? (
                        <p className="text-xs text-muted-foreground italic truncate">{copy.notes}</p>
                      ) : (
                        <span className="text-muted-foreground/25">—</span>
                      )}
                    </td>

                    {/* Barcode and lifecycle actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDownload(copy.barcode)}
                        disabled={!copy.is_active || !barcodeUrls[copy.barcode]}
                        className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs font-bold  text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </button>
                      <button onClick={() => handlePrint(copy.barcode)} disabled={!copy.is_active || !barcodeUrls[copy.barcode]} className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-30" style={{ fontFamily: "var(--font-heading)" }}>
                        <Printer className="h-3 w-3" /> Print
                      </button>
                      {!copy.is_active ? <button type="button" onClick={() => void handleRestore(copy)} disabled={busyCopyId !== null} className="flex items-center gap-1.5 border border-success/30 px-2.5 py-1.5 text-xs font-bold text-success hover:bg-success/5 disabled:opacity-50"><ArchiveRestore className="h-3 w-3" />{busyCopyId === copy.id ? "Restoring…" : "Restore"}</button> : <button type="button" onClick={() => void handleRetire(copy)} disabled={busyCopyId !== null || copy.status === "borrowed" || copy.status === "reserved"} className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-40"><Archive className="h-3 w-3" />{busyCopyId === copy.id ? "Retiring…" : "Retire"}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCopiesModal;
