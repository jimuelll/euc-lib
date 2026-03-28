import { LogIn, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import type { AttendanceType } from "../types";

interface IdleViewProps {
  onStart: (type: AttendanceType) => void;
}

const IdleView = ({ onStart }: IdleViewProps) => (
  <motion.div
    key="idle"
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

      {/* Buttons */}
      <div className="grid grid-cols-2 bg-background">
        <button
          onClick={() => onStart("check_in")}
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
          onClick={() => onStart("check_out")}
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

      {/* Footer hint */}
      <div className="px-8 py-4 border-b border-border bg-muted/20">
        <p
          className="text-[10px] text-center text-muted-foreground/50 uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Scan your student / employee ID barcode
        </p>
      </div>
    </div>
  </motion.div>
);

export default IdleView;