import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import type { AttendanceResult, AttendanceType, ScanMode } from "../types";
import { AUTO_RESET_DELAY } from "../utils";

// ─── Success ──────────────────────────────────────────────────────────────────

interface SuccessViewProps {
  result: AttendanceResult;
  onReset: () => void;
}

export const SuccessView = ({ result, onReset }: SuccessViewProps) => {
  const timeString = result.timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateString = result.timestamp.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const rows: { label: string; value: React.ReactNode; mono?: boolean; large?: boolean }[] = [
    { label: "Name", value: result.userName },
    { label: "ID", value: result.studentId, mono: true },
    { label: "Date", value: dateString },
    { label: "Time", value: timeString, large: true },
    {
      label: "Status",
      value:
        result.type === "check_in"
          ? "Arrival logged. Have a productive visit."
          : "Departure logged. See you next time.",
    },
  ];

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-sm"
    >
      <div className="border border-border overflow-hidden">
        {/* Header */}
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

        {/* Detail rows */}
        <div className="bg-background">
          {rows.map(({ label, value, mono, large }, i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-8 py-4 ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {label}
              </span>
              <span
                className={`${large ? "text-lg font-bold text-foreground" : "text-sm text-foreground"} ${
                  mono ? "font-mono" : ""
                } ${label === "Status" ? "text-xs text-muted-foreground" : ""}`}
                style={large ? { fontFamily: "var(--font-heading)" } : undefined}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Reset */}
        <button
          onClick={onReset}
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
  );
};

// ─── Error ────────────────────────────────────────────────────────────────────

interface ErrorViewProps {
  errorMsg: string;
  attendanceType: AttendanceType;
  onRetry: (type: AttendanceType) => void;
  onBack: () => void;
}

export const ErrorView = ({ errorMsg, attendanceType, onRetry, onBack }: ErrorViewProps) => (
  <motion.div
    key="error"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.35 }}
    className="w-full max-w-sm"
  >
    <div className="border border-border overflow-hidden">
      {/* Header */}
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

      {/* Error message */}
      <div className="px-8 py-5 bg-background border-b border-border">
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 bg-background">
        <button
          onClick={() => onRetry(attendanceType)}
          className="flex items-center justify-center gap-2 border-r border-border py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:bg-muted transition-colors"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Back
        </button>
      </div>
    </div>
  </motion.div>
);