import { useEffect, useRef, useState, useCallback } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine, Loader2, Download } from "lucide-react";

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

const CONDITION_COLORS: Record<string, string> = {
  good:    "bg-green-100 text-green-700",
  damaged: "bg-yellow-100 text-yellow-700",
  lost:    "bg-red-100 text-red-700",
};

// Fetch barcode PNG via axios (handles auth headers) and return an object URL
const fetchBarcodeObjectUrl = async (barcode: string): Promise<string> => {
  const res = await axiosInstance.get(
    `api/admin/copies/${encodeURIComponent(barcode)}/barcode-png`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(res.data);
};

const BookCopiesModal = ({ bookId, bookTitle, onClose }: Props) => {
  const [copies, setCopies]               = useState<Copy[]>([]);
  const [loading, setLoading]             = useState(true);
  const [scanning, setScanning]           = useState(false);
  const [scannedCopy, setScannedCopy]     = useState<(Copy & { title?: string; author?: string }) | null>(null);
  // map barcode → object URL so each image only loads once
  const [barcodeUrls, setBarcodeUrls]     = useState<Record<string, string>>({});
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // ── Fetch copies ────────────────────────────────────────────────────────────
  useEffect(() => {
    axiosInstance
      .get(`api/admin/books/${bookId}/copies`)
      .then((res) => setCopies(res.data))
      .catch(() => toast.error("Failed to load copies"))
      .finally(() => setLoading(false));
  }, [bookId]);

  // ── Load barcode images as blob URLs (bypasses cross-origin download block) ─
  useEffect(() => {
    if (!copies.length) return;
    copies.forEach(async (copy) => {
      if (barcodeUrls[copy.barcode]) return; // already loaded
      try {
        const url = await fetchBarcodeObjectUrl(copy.barcode);
        setBarcodeUrls((prev) => ({ ...prev, [copy.barcode]: url }));
      } catch {
        // image will just not render — onError handles it
      }
    });
  }, [copies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      Object.values(barcodeUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ZXing scanner ───────────────────────────────────────────────────────────
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
            // Pre-load barcode image for scan result too
            if (!barcodeUrls[barcode]) {
              const url = await fetchBarcodeObjectUrl(barcode);
              setBarcodeUrls((prev) => ({ ...prev, [barcode]: url }));
            }
          } catch {
            toast.error(`Copy not found: ${barcode}`);
          }
        }
        if (err && err.name !== "NotFoundException") {
          console.warn("[ZXing]", err.message);
        }
      })
      .then((controls) => { controlsRef.current = controls; })
      .catch((e) => {
        toast.error("Camera error: " + e.message);
        stopScanner();
      });

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scanning, stopScanner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Blob download (fixes about:blank blocked) ───────────────────────────────
  const handleDownload = (barcode: string) => {
    const url = barcodeUrls[barcode];
    if (!url) { toast.error("Barcode not loaded yet"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${barcode}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-xl border bg-background shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Book Copies</p>
            <h3 className="text-sm font-semibold text-foreground truncate max-w-[380px]">
              {bookTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={scanning ? stopScanner : startScanner}>
              <ScanLine className="mr-1.5 h-3.5 w-3.5" />
              {scanning ? "Stop Scan" : "Scan Barcode"}
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">

          {/* Scanner view */}
          {scanning && (
            <div className="rounded-lg overflow-hidden border">
              <video ref={videoRef} className="w-full" />
              <p className="py-2 text-center text-xs text-muted-foreground">
                Point camera at a book barcode
              </p>
            </div>
          )}

          {/* Scan result */}
          {scannedCopy && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground mb-3">Scan Result</p>
              <div className="flex gap-4 items-start">
                {barcodeUrls[scannedCopy.barcode] && (
                  <img
                    src={barcodeUrls[scannedCopy.barcode]}
                    alt={scannedCopy.barcode}
                    className="h-14 w-auto rounded border bg-white p-1"
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs flex-1">
                  <span className="text-muted-foreground">Barcode</span>
                  <span className="font-mono">{scannedCopy.barcode}</span>
                  {scannedCopy.title && (
                    <>
                      <span className="text-muted-foreground">Book</span>
                      <span>{scannedCopy.title}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Status</span>
                  <span className={scannedCopy.status === "borrowed" ? "text-destructive" : "text-green-600"}>
                    {scannedCopy.status}
                  </span>
                  <span className="text-muted-foreground">Condition</span>
                  <span>{scannedCopy.condition}</span>
                  {scannedCopy.borrower_name && (
                    <>
                      <span className="text-muted-foreground">Borrower</span>
                      <span>{scannedCopy.borrower_name}</span>
                      <span className="text-muted-foreground">Due</span>
                      <span>{scannedCopy.due_date}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Copies list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : copies.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No copies found.</p>
          ) : (
            <div className="space-y-3">
              {copies.map((copy) => (
                <div
                  key={copy.id}
                  className={`rounded-lg border p-3 ${!copy.is_active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-4">

                    {/* Barcode image */}
                    {barcodeUrls[copy.barcode] ? (
                      <img
                        src={barcodeUrls[copy.barcode]}
                        alt={copy.barcode}
                        className="h-14 w-auto rounded border bg-white p-1 shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-28 shrink-0 rounded border bg-muted flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {/* Copy details */}
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="font-mono font-medium text-foreground">
                          {copy.barcode}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            copy.status === "borrowed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {copy.status}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONDITION_COLORS[copy.condition]}`}>
                          {copy.condition}
                        </span>
                        {!copy.is_active && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            inactive
                          </span>
                        )}
                      </div>
                      {copy.borrower_name && (
                        <p className="text-muted-foreground">
                          Borrowed by{" "}
                          <span className="text-foreground font-medium">{copy.borrower_name}</span>
                          {copy.due_date && <> · due {copy.due_date}</>}
                        </p>
                      )}
                      {copy.notes && (
                        <p className="text-muted-foreground italic">{copy.notes}</p>
                      )}
                    </div>

                    {/* Download button — uses blob URL, no about:blank block */}
                    <button
                      onClick={() => handleDownload(copy.barcode)}
                      disabled={!barcodeUrls[copy.barcode]}
                      title="Download barcode"
                      className="shrink-0 rounded border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-40 flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCopiesModal;