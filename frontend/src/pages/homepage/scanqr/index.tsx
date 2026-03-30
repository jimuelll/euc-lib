import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { QrCode } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import IdleView from "./components/IdleView";
import ScanningView from "./components/ScanningView";
import { SuccessView, NoticeView, ErrorView } from "./components/ResultView";
import type { ScanMode, AttendanceType, AttendanceResult, AttendanceNotice } from "./types";
import { postAttendanceScan, AttendanceScanError, AUTO_RESET_DELAY } from "./utils";

// ─── Page ─────────────────────────────────────────────────────────────────────

const ScanQR = () => {
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("check_in");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [notice, setNotice] = useState<AttendanceNotice | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Ref-based processing guard prevents rapid double-scans from slipping through
  const isProcessingRef = useRef(false);
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-reset after success so operators don't have to click "Scan Again" each time
  useEffect(() => {
    if (scanMode === "success") {
      autoResetTimerRef.current = setTimeout(reset, AUTO_RESET_DELAY);
    }
    return () => {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const startScanning = (type: AttendanceType) => {
    setAttendanceType(type);
    setErrorMsg("");
    setScanMode("scanning");
  };

  const reset = () => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    isProcessingRef.current = false;
    setScanMode("idle");
    setResult(null);
    setNotice(null);
    setErrorMsg("");
  };

  const handleScannedValue = useCallback(
    async (scannedId: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setScanMode("processing");
      setErrorMsg("");
      setNotice(null);

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
        if (
          err instanceof AttendanceScanError &&
          (err.code === "ALREADY_TIMED_IN" || err.code === "ALREADY_TIMED_OUT") &&
          err.user &&
          err.type
        ) {
          setNotice({
            type: err.type,
            userName: err.user.name,
            studentId: err.user.student_employee_id,
            message: err.message,
          });
          setScanMode("notice");
        } else {
          setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred");
          setScanMode("error");
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [attendanceType]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Page header */}
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

      {/* Main content */}
      <main className="flex-1 bg-background py-14">
        <div className="container px-4 sm:px-6 flex justify-center">
          <AnimatePresence mode="wait">
            {scanMode === "idle" && (
              <IdleView key="idle" onStart={startScanning} />
            )}

            {(scanMode === "scanning" || scanMode === "processing") && (
              <ScanningView
                key="scanning"
                scanMode={scanMode}
                attendanceType={attendanceType}
                onScanned={handleScannedValue}
                onCancel={reset}
              />
            )}

            {scanMode === "success" && result && (
              <SuccessView key="success" result={result} onReset={reset} />
            )}

            {scanMode === "notice" && notice && (
              <NoticeView key="notice" notice={notice} onReset={reset} />
            )}

            {scanMode === "error" && (
              <ErrorView
                key="error"
                errorMsg={errorMsg}
                attendanceType={attendanceType}
                onRetry={startScanning}
                onBack={reset}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ScanQR;
