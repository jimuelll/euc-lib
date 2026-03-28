import { useEffect, useRef, useState, useCallback } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { toast } from "@/components/ui/sonner";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine, Loader2, Download, BookOpen } from "lucide-react";

type Copy = {
  id: number;
  barcode: string;
  condition: "good" | "damaged" | "lost";
  is_active: number;
  status: "available" | "borrowed";
  due_date?: string;
  borrower_name?: string;
  notes?: string;
};

type Props = {
  bookId: number;
  bookTitle: string;
  onClose: () => void;
};

const CONDITION_CONFIG: Record<string, { label: string; className: string }> = {
  good:    { label: "Good",    className: "border-success/30 text-success bg-success/5"           },
  damaged: { label: "Damaged", className: "border-warning/40 text-warning bg-warning/5"           },
  lost:    { label: "Lost",    className: "border-destructive/30 text-destructive bg-destructive/5" },
};

const STATUS_CONFIG = {
  available: { label: "Available", className: "border-success/30 text-success bg-success/5"           },
  borrowed:  { label: "Borrowed",  className: "border-destructive/30 text-destructive bg-destructive/5" },
};

const fetchBarcodeObjectUrl = async (barcode: string): Promise<string> => {
  const res = await axiosInstance.get(
    `api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(res.data);
};

// ─── Badge ────────────────────────────────────────────────────────────────────

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${className ?? ""}`}
    style={{ fontFamily: "var(--font-heading)" }}
  >
    {children}
  </span>
);

// ─── Detail row (scan result grid) ───────────────────────────────────────────

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <dt
      className="py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground border-b border-border/50"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {label}
    </dt>
    <dd className="py-2 text-sm text-foreground border-b border-border/50">{value}</dd>
  </>
);

// ─── Main component ───────────────────────────────────────────────────────────

const BookCopiesModal = ({ bookId, bookTitle, onClose }: Props) => {
  const [copies, setCopies]           = useState<Copy[]>([]);
  const [loading, setLoading]         = useState(true);
  const [scanning, setScanning]       = useState(false);
  const [scannedCopy, setScannedCopy] = useState<(Copy & { title?: string; author?: string }) | null>(null);
  const [barcodeUrls, setBarcodeUrls] = useState<Record<string, string>>({});
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    axiosInstance
      .get(`api/admin/books/${bookId}/copies`)
      .then((res) => setCopies(res.data))
      .catch(() => toast.error("Failed to load copies"))
      .finally(() => setLoading(false));
  }, [bookId]);

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
            const res = await axiosInstance.get(`api/admin/copies/${encodeURIComponent(barcode)}`);
            setScannedCopy(res.data);
            if (!barcodeUrls[barcode]) {
              const url = await fetchBarcodeObjectUrl(barcode);
              setBarcodeUrls((prev) => ({ ...prev, [barcode]: url }));
            }
          } catch { toast.error(`Copy not found: ${barcode}`); }
        }
        if (err && err.name !== "NotFoundException") console.warn("[ZXing]", err.message);
      })
      .then((controls) => { controlsRef.current = controls; })
      .catch((e) => { toast.error("Camera error: " + e.message); stopScanner(); });
    return () => { controlsRef.current?.stop(); controlsRef.current = null; };
  }, [scanning, stopScanner]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = (barcode: string) => {
    const url = barcodeUrls[barcode];
    if (!url) { toast.error("Barcode not loaded yet"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `${barcode}.png`; a.click();
  };

  const available = copies.filter((c) => c.status === "available" && c.is_active).length;
  const borrowed  = copies.filter((c) => c.status === "borrowed").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Gold top rule */}
        <div className="h-[3px] w-full bg-warning shrink-0" />

        {/* ── Modal header ──────────────────────────────────────────── */}
        <div className="bg-primary shrink-0">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3 min-w-0">
              <BookOpen className="h-4 w-4 text-primary-foreground/40 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary-foreground/45 mb-0.5"
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
                className="flex items-center gap-1.5 border border-primary-foreground/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/70 hover:border-warning hover:text-warning transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <ScanLine className="h-3.5 w-3.5" />
                {scanning ? "Stop Scan" : "Scan"}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-primary-foreground/40 hover:text-primary-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary strip — available/borrowed counts */}
          {!loading && copies.length > 0 && (
            <div className="flex divide-x divide-primary-foreground/10 border-t border-primary-foreground/10">
              {[
                { label: "Total",     value: copies.length },
                { label: "Available", value: available     },
                { label: "Borrowed",  value: borrowed      },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 px-5 py-2.5 text-center">
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-foreground/40"
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
        <div className="flex-1 overflow-y-auto">

          {/* Scanner view */}
          {scanning && (
            <div className="border-b border-border bg-black">
              <video ref={videoRef} className="w-full max-h-56 object-cover" />
              <p
                className="py-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
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
                  className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary"
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
                  {scannedCopy.title       && <DetailRow label="Book"     value={scannedCopy.title}        />}
                  <DetailRow label="Status"    value={scannedCopy.status}    />
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
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Loading copies…
              </p>
            </div>
          ) : copies.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <BookOpen className="h-8 w-8 text-muted-foreground/15" />
              <p
                className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                No copies found
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              {/* Table head */}
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/50">
                  {["#", "Barcode", "Status", "Condition", "Borrower / Notes", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left"
                    >
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60"
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
                        className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground/30"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>

                    {/* Barcode image + code */}
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
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
                          </div>
                        )}
                        <span className="font-mono text-xs text-foreground">{copy.barcode}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge className={STATUS_CONFIG[copy.status].className}>
                        {STATUS_CONFIG[copy.status].label}
                      </Badge>
                      {!copy.is_active && (
                        <Badge className="ml-1 border-border text-muted-foreground/50">Inactive</Badge>
                      )}
                    </td>

                    {/* Condition */}
                    <td className="px-4 py-3">
                      <Badge className={CONDITION_CONFIG[copy.condition]?.className}>
                        {CONDITION_CONFIG[copy.condition]?.label ?? copy.condition}
                      </Badge>
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
                        <p className="text-xs text-muted-foreground/60 italic truncate">{copy.notes}</p>
                      ) : (
                        <span className="text-muted-foreground/25">—</span>
                      )}
                    </td>

                    {/* Download */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDownload(copy.barcode)}
                        disabled={!barcodeUrls[copy.barcode]}
                        className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-30"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </button>
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