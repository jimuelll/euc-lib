import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  QrCode,
  Camera,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Keyboard,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "@/utils/AxiosInstance";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanMode = "idle" | "scanning" | "processing" | "success" | "error";
type AttendanceType = "check_in" | "check_out";

interface AttendanceResult {
  type: AttendanceType;
  userName: string;
  studentId: string;
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long to show the success screen before auto-resetting (ms) */
const AUTO_RESET_DELAY = 3000;

// ─── ZXing hook ───────────────────────────────────────────────────────────────

interface UseZxingScannerOptions {
  onResult: (text: string) => void;
  active: boolean;
}

const useZxingScanner = ({ onResult, active }: UseZxingScannerOptions) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setCameraError(null);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          onResult(result.getText());
          reader.reset();
        }
        if (err && !(err instanceof NotFoundException)) {
          setCameraError("Camera error — check permissions");
        }
      })
      .catch(() => setCameraError("Could not start camera"));

    return () => {
      reader.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { videoRef, cameraError };
};

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = "/api";

const postAttendanceScan = async (
  scannedId: string,
  type: AttendanceType
): Promise<{ user: { name: string; student_employee_id: string }; type: AttendanceType }> => {
  const res = await axiosInstance.post("/api/attendance/scan", { scannedId, type });
  return res.data;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ScanQR = () => {
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("check_in");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Manual-entry fallback
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  // FIX: Use a ref for the processing guard instead of reading scanMode from
  // stale closure state inside the useCallback. This prevents rapid double-scans
  // from slipping through the debounce.
  const isProcessingRef = useRef(false);

  // Auto-reset timer ref so we can cancel it if the user manually resets early
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isScanning = scanMode === "scanning";

  // Focus manual input when switching to manual mode
  useEffect(() => {
    if (manualMode) {
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [manualMode]);

  // FIX: Auto-reset after success so scanner operators don't have to click
  // "Scan Again" between every student. Cancelled if the user resets manually.
  useEffect(() => {
    if (scanMode === "success") {
      autoResetTimerRef.current = setTimeout(() => {
        reset();
      }, AUTO_RESET_DELAY);
    }
    return () => {
      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  // ── Handle a decoded barcode value ──────────────────────────────────────────
  const handleScannedValue = useCallback(
    async (scannedId: string) => {
      // FIX: Use ref instead of stale scanMode closure for the processing guard
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setScanMode("processing");
      setErrorMsg("");

      try {
        const data = await postAttendanceScan(scannedId.trim(), attendanceType);
        setResult({
          type: data.type,
          userName: data.user.name,
          studentId: data.user.student_employee_id,
          timestamp: new Date(),
        });
        setScanMode("success");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred");
        setScanMode("error");
      } finally {
        isProcessingRef.current = false;
      }
    },
    [attendanceType]
  );

  // ── ZXing ───────────────────────────────────────────────────────────────────
  const { videoRef, cameraError } = useZxingScanner({
    onResult: handleScannedValue,
    active: isScanning && !manualMode,
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const startScanning = (type: AttendanceType) => {
    setAttendanceType(type);
    setManualInput("");
    setErrorMsg("");
    setScanMode("scanning");
  };

  const reset = () => {
    // Cancel any pending auto-reset to avoid double-firing
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }
    isProcessingRef.current = false;
    setScanMode("idle");
    setResult(null);
    setErrorMsg("");
    // FIX: Clear manual input on every reset so stale IDs don't persist
    setManualInput("");
    setManualMode(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScannedValue(manualInput.trim());
    }
  };

  const now = result?.timestamp ?? new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateString = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Page header band ── */}
      <div className="bg-primary border-b border-primary-foreground/10 relative overflow-hidden">
        <div className="h-[3px] w-full bg-warning" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
        <div className="container px-4 sm:px-6 py-10 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-6 bg-warning" />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Scanner Tool
            </span>
          </div>
          <div className="flex items-center gap-4">
            <QrCode className="h-7 w-7 text-primary-foreground/60 shrink-0" />
            <h1
              className="text-2xl sm:text-3xl font-bold text-primary-foreground tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Attendance Scanner
            </h1>
          </div>
          <p className="mt-2 text-sm text-primary-foreground/50 max-w-md leading-relaxed ml-11">
            Scan your library ID barcode to log your attendance.
          </p>
        </div>
      </div>

      <main className="flex-1 bg-background py-14">
        <div className="container px-4 sm:px-6 flex justify-center">
          <AnimatePresence mode="wait">

            {/* ── Idle — choose check-in or check-out ── */}
            {scanMode === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-sm"
              >
                <div className="border border-border overflow-hidden">
                  <div className="bg-primary px-8 py-6 relative overflow-hidden">
                    <div className="h-[2px] w-full bg-warning absolute top-0 left-0" />
                    <div
                      className="absolute inset-0 opacity-[0.05] pointer-events-none"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
                      }}
                    />
                    <div className="relative z-10">
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/50 mb-1"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Select Action
                      </p>
                      <h2
                        className="text-lg font-bold text-primary-foreground tracking-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Log Attendance
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 bg-background">
                    <button
                      onClick={() => startScanning("check_in")}
                      className="flex flex-col items-center justify-center gap-2 border-r border-b border-border bg-background px-4 py-8 hover:bg-primary hover:text-primary-foreground transition-colors duration-200 group"
                    >
                      <LogIn className="h-6 w-6 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                      <span
                        className="text-[11px] font-bold tracking-[0.18em] uppercase text-foreground group-hover:text-primary-foreground transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Time In
                      </span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/60 transition-colors">
                        Arrival
                      </span>
                    </button>
                    <button
                      onClick={() => startScanning("check_out")}
                      className="flex flex-col items-center justify-center gap-2 border-b border-border bg-background px-4 py-8 hover:bg-muted transition-colors duration-200 group"
                    >
                      <LogOut className="h-6 w-6 text-muted-foreground transition-colors" />
                      <span
                        className="text-[11px] font-bold tracking-[0.18em] uppercase text-foreground transition-colors"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Time Out
                      </span>
                      <span className="text-[10px] text-muted-foreground">Departure</span>
                    </button>
                  </div>

                  <div className="px-8 py-4 border-b border-border bg-muted/20">
                    <p className="text-[10px] text-center text-muted-foreground/50 uppercase tracking-[0.12em]"
                      style={{ fontFamily: "var(--font-heading)" }}>
                      Scan your student / employee ID barcode
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Scanning / Camera active ── */}
            {(scanMode === "scanning" || scanMode === "processing") && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-sm"
              >
                {/* Mode label */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {attendanceType === "check_in" ? "Time In" : "Time Out"}
                  </span>
                  <button
                    onClick={reset}
                    className="text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Viewfinder */}
                <div className="relative border border-border bg-card aspect-square w-full overflow-hidden">
                  <span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-primary z-10" />
                  <span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-primary z-10" />
                  <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary z-10" />
                  <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary z-10" />

                  {/* Camera feed */}
                  {!manualMode && (
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  )}

                  {/* Scanning line animation (shown when not processing) */}
                  {scanMode === "scanning" && !manualMode && (
                    <motion.div
                      className="absolute left-0 right-0 h-px bg-warning/70 z-10"
                      animate={{ top: ["12%", "88%", "12%"] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}

                  {/* Processing overlay */}
                  {scanMode === "processing" && (
                    <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3 z-20">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Logging…
                      </p>
                    </div>
                  )}

                  {/* Camera error */}
                  {cameraError && !manualMode && scanMode === "scanning" && (
                    <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-3 px-6 z-20">
                      <AlertTriangle className="h-8 w-8 text-destructive/60" />
                      <p className="text-xs text-center text-muted-foreground">{cameraError}</p>
                      <button
                        onClick={() => setManualMode(true)}
                        className="text-[10px] uppercase tracking-wider text-primary hover:underline"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Enter ID manually
                      </button>
                    </div>
                  )}

                  {/* Manual input mode */}
                  {manualMode && scanMode !== "processing" && (
                    <div className="absolute inset-0 bg-background flex flex-col items-center justify-center gap-4 px-6">
                      <Camera className="h-8 w-8 text-muted-foreground/25" />
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 text-center"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Manual ID Entry
                      </p>
                      <form onSubmit={handleManualSubmit} className="w-full max-w-[220px]">
                        <input
                          ref={manualInputRef}
                          value={manualInput}
                          onChange={(e) => setManualInput(e.target.value)}
                          placeholder="e.g. A23-0121"
                          className="w-full border border-border bg-background px-3 py-2 text-sm text-center tracking-widest text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary"
                        />
                        <button
                          type="submit"
                          disabled={!manualInput.trim()}
                          className="mt-2 w-full border border-primary bg-primary text-primary-foreground py-2 text-[10px] font-bold uppercase tracking-[0.18em] hover:bg-primary/90 disabled:opacity-40 transition-colors"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-warning/[0.02] pointer-events-none" />
                </div>

                {/* Toggle manual / camera */}
                <div className="grid grid-cols-2 border-l border-b border-r border-border">
                  <button
                    onClick={() => setManualMode(false)}
                    disabled={scanMode === "processing"}
                    className={`flex items-center justify-center gap-2 border-r border-border py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-colors duration-200 disabled:opacity-40 ${
                      !manualMode
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Camera
                  </button>
                  <button
                    onClick={() => setManualMode(true)}
                    disabled={scanMode === "processing"}
                    className={`flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-colors duration-200 disabled:opacity-40 ${
                      manualMode
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    Manual
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Success ── */}
            {scanMode === "success" && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-sm"
              >
                <div className="border border-border overflow-hidden">
                  <div className="bg-primary px-8 py-6 relative overflow-hidden">
                    <div className="h-[2px] w-full bg-warning absolute top-0 left-0" />
                    <div
                      className="absolute inset-0 opacity-[0.05] pointer-events-none"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
                      }}
                    />
                    <div className="relative z-10 flex items-center gap-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 220, delay: 0.15 }}
                      >
                        <CheckCircle2 className="h-8 w-8 text-warning" />
                      </motion.div>
                      <div>
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {result.type === "check_in" ? "Time In" : "Time Out"}
                        </p>
                        <h2
                          className="text-lg font-bold text-primary-foreground tracking-tight"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Attendance Recorded
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background">
                    <div className="flex items-center justify-between border-b border-border px-8 py-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Name
                      </span>
                      <span className="text-sm font-medium text-foreground">{result.userName}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border px-8 py-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        ID
                      </span>
                      <span className="text-sm font-mono text-foreground">{result.studentId}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border px-8 py-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Date
                      </span>
                      <span className="text-sm text-foreground">{dateString}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border px-8 py-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Time
                      </span>
                      <span
                        className="text-lg font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {timeString}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-8 py-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Status
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {result.type === "check_in"
                          ? "Arrival logged. Have a productive visit."
                          : "Departure logged. See you next time."}
                      </span>
                    </div>
                  </div>

                  {/* FIX: Show auto-reset countdown and allow manual early reset */}
                  <button
                    onClick={reset}
                    className="w-full border-t border-border bg-background py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Scan Again
                    <span className="text-[9px] text-muted-foreground/40 font-normal normal-case tracking-normal ml-1">
                      (auto-resets in {AUTO_RESET_DELAY / 1000}s)
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Error ── */}
            {scanMode === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-sm"
              >
                <div className="border border-border overflow-hidden">
                  <div className="bg-destructive/10 border-b border-destructive/20 px-8 py-6 flex items-center gap-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 220, delay: 0.1 }}
                    >
                      <XCircle className="h-8 w-8 text-destructive" />
                    </motion.div>
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-destructive/60"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Scan Failed
                      </p>
                      <h2
                        className="text-base font-bold text-foreground tracking-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Could not record attendance
                      </h2>
                    </div>
                  </div>

                  <div className="px-8 py-5 bg-background border-b border-border">
                    <p className="text-sm text-muted-foreground">{errorMsg}</p>
                  </div>

                  <div className="grid grid-cols-2 bg-background">
                    <button
                      onClick={() => startScanning(attendanceType)}
                      className="flex items-center justify-center gap-2 border-r border-border py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:bg-muted transition-colors"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ScanQR;