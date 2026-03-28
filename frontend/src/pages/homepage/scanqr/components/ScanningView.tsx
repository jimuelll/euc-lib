import { useRef, useEffect, useState } from "react";
import { Camera, Keyboard, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useZxingScanner } from "../hooks/useZxingScanner";
import type { AttendanceType, ScanMode } from "../types";

interface ScanningViewProps {
  scanMode: ScanMode;
  attendanceType: AttendanceType;
  onScanned: (value: string) => void;
  onCancel: () => void;
}

const ScanningView = ({ scanMode, attendanceType, onScanned, onCancel }: ScanningViewProps) => {
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = scanMode === "processing";

  useEffect(() => {
    if (manualMode) {
      setTimeout(() => manualInputRef.current?.focus(), 100);
    }
  }, [manualMode]);

  const { videoRef, cameraError } = useZxingScanner({
    onResult: onScanned,
    active: scanMode === "scanning" && !manualMode,
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScanned(manualInput.trim());
    }
  };

  return (
    <motion.div
      key="scanning"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-sm"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {attendanceType === "check_in" ? "Time In" : "Time Out"}
        </span>
        <button
          onClick={onCancel}
          className="text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Cancel
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative border border-border bg-card aspect-square w-full overflow-hidden">
        {/* Corner brackets */}
        <span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-primary z-10" />
        <span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-primary z-10" />
        <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary z-10" />
        <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-primary z-10" />

        {/* Camera feed */}
        {!manualMode && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Scanning line */}
        {scanMode === "scanning" && !manualMode && (
          <motion.div
            className="absolute left-0 right-0 h-px bg-warning/70 z-10"
            animate={{ top: ["12%", "88%", "12%"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
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

        {/* Manual input */}
        {manualMode && !isProcessing && (
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

      {/* Camera / Manual toggle */}
      <div className="grid grid-cols-2 border-l border-b border-r border-border">
        {[
          { label: "Camera", icon: <Camera className="h-3.5 w-3.5" />, active: !manualMode, onClick: () => setManualMode(false) },
          { label: "Manual", icon: <Keyboard className="h-3.5 w-3.5" />, active: manualMode, onClick: () => setManualMode(true) },
        ].map(({ label, icon, active, onClick }, i) => (
          <button
            key={label}
            onClick={onClick}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-colors duration-200 disabled:opacity-40 ${
              i === 0 ? "border-r border-border" : ""
            } ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default ScanningView;